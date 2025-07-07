import { ANDROID_CLIENT_ID, IOS_CLIENT_ID, WEB_CLIENT_ID } from '@/shared/constants';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const TOKEN_STORAGE_KEY = 'accessToken';

type AuthContextType = {
  accessToken: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  userInfo: { name: string; email: string; picture: string } | null;
  isLoading: boolean;
  error: string | null;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextType>({
  accessToken: null,
  signIn: async () => {},
  signOut: async () => {},
  userInfo: null,
  isLoading: false,
  error: null,
  fetchWithAuth: async (url) => new Response(null, { status: 401, statusText: 'Not Authenticated' }),
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ name: string; email: string; picture: string } | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = "https://auth.expo.io/@dangtanphat/TwinMindApp";

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
    scopes: ['openid', 'profile', 'email', 'https://www.googleapis.com/auth/calendar.readonly'],
    redirectUri,
  });

  const fetchUserInfo = useCallback(async (token: string) => {
    try {
      const resp = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to fetch user info');
      const data = await resp.json();
      setUserInfo(data);
    } catch (e) {
      console.error('Error fetching user info:', e);
    }
  }, []);
  
  const exchangeCodeForToken = useCallback(async (code: string) => {
    try {
      const res = await fetch('/api/auth/exchange-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Code exchange failed');
      }
      const { access_token } = await res.json();
      if (access_token) {
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, access_token);
        setAccessToken(access_token);
        fetchUserInfo(access_token);
      }
    } catch (e: any) {
      console.error('Error exchanging code for token:', e);
      setError(e.message);
    }
  }, [fetchUserInfo]);

  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeCodeForToken(code);
    } else if (response?.type === 'error') {
      setError(response.error?.message || 'Authentication failed');
    }
  }, [response, exchangeCodeForToken]);

  useEffect(() => {
    const restoreToken = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
        if (storedToken) {
          setAccessToken(storedToken);
          await fetchUserInfo(storedToken);
        }
      } catch (e) {
        console.error("Failed to restore token", e);
      } finally {
        setIsRestoring(false);
      }
    };
    restoreToken();
  }, [fetchUserInfo]);
  
  const signIn = useCallback(async () => {
    setError(null);
    await promptAsync();
  }, [promptAsync]);
  
  const signOut = useCallback(async () => {
    if (!accessToken) return;
    try {
      await AuthSession.revokeAsync({
        token: accessToken,
        clientId: WEB_CLIENT_ID, // Changed from EXPO_PUBLIC_WEB_CLIENT_ID to WEB_CLIENT_ID
      }, {
        revocationEndpoint: 'https://oauth2.googleapis.com/revoke'
      });
    } catch(e) {
      console.error("Failed to revoke token", e);
    }
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    setAccessToken(null);
    setUserInfo(null);
  }, [accessToken]);

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
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
  }, [accessToken]);

  const value = useMemo(
    () => ({ accessToken, signIn, signOut, userInfo, isLoading: !request || isRestoring, error, fetchWithAuth }),
    [accessToken, signIn, signOut, userInfo, request, isRestoring, error, fetchWithAuth]
  );

  console.log("Client redirect URI:", redirectUri);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);