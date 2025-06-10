import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

type AuthContextType = {
  accessToken: string | null;
  signIn: () => Promise<void>;
  userInfo: { name: string; email: string; picture: string } | null;
  isLoading: boolean;
  error: string | null;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextType>({
  accessToken: null,
  signIn: async () => {},
  userInfo: null,
  isLoading: false,
  error: null,
  fetchWithAuth: async (url) => new Response(null, { status: 401, statusText: 'Not Authenticated' }),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; picture: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWeb = Platform.OS === 'web';

  const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:8081';
  const APP_SCHEME = process.env.EXPO_PUBLIC_SCHEME || 'twinmind';
  const redirectUri = `${BASE_URL}/api/auth/callback/google`; // Match authorized URI
  const expoRedirectUri = Linking.createURL('/auth/callback', { scheme: APP_SCHEME }); // For Expo callback

  useEffect(() => {
    // Handle deep link callback
    const handleDeepLink = ({ url }: { url: string }) => {
      const { pathname, searchParams } = new URL(url);
      if (pathname === '/auth/callback') {
        const accessToken = searchParams.get('access_token');
        const state = searchParams.get('state');
        if (accessToken) {
          setAccessToken(accessToken);
          // Fetch user info (optional, based on token)
          fetchUserInfo(accessToken);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url) => url && handleDeepLink({ url }));

    return () => subscription.remove(); // Use the remove method from the subscription
  }, []);

  const fetchUserInfo = async (token: string) => {
    try {
      const resp = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to fetch user info');
      const data = await resp.json();
      setUserInfo({
        name: data.name || 'Unknown',
        email: data.email || 'unknown@example.com',
        picture: data.picture || '',
      });
    } catch (e) {
      console.error('Error fetching user info:', e);
    }
  };

  const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
    if (!accessToken) {
      console.error('fetchWithAuth: No access token available.');
      return new Response(null, { status: 401, statusText: 'Not Authenticated' });
    }
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    };
    const response = await fetch(url, { ...options, headers });
    return response;
  };

  const signIn = async () => {
    console.log('signIn: Starting authentication process...');
    setIsLoading(true);
    setError(null);
    try {
      const state = Math.random().toString(36).substring(7);
      const params = new URLSearchParams({
        client_id: 'google',
        redirect_uri: redirectUri,
        scope: 'openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.readonly',
        state: state,
      });
      console.log('DEBUG: Client redirect_uri:', redirectUri);
      const authUrl = `${BASE_URL}/api/backend/authorize?${params.toString()}`;
      console.log('signIn: Opening auth URL:', authUrl);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, expoRedirectUri, {
        showInRecents: true,
      });
      console.log('signIn: Auth session result:', result);
    } catch (e: any) {
      console.error('signIn: Error during authentication:', e);
      setError(e.message || 'Failed to sign in');
      if (e.message.includes('Maximum call stack')) {
        Alert.alert('Authentication Error', 'Redirect loop detected. Please ensure the backend is running and accessible.');
      }
    } finally {
      setIsLoading(false);
      await WebBrowser.dismissAuthSession();
      await WebBrowser.dismissBrowser();
    }
  };

  const value = useMemo(
    () => ({ accessToken, signIn, userInfo, isLoading, error, fetchWithAuth }),
    [accessToken, signIn, userInfo, isLoading, error, fetchWithAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);