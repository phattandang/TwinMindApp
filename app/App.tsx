import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/auth';
import CalendarScreen from './CalendarScreen';
import LoginScreen from './Login';
import TranscriptionScreen from './TranscriptionScreen';

export type RootStackParamList = {
  Login: undefined;
  Calendar: undefined;
  Transcription: undefined;
  AuthCallback: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      </AuthProvider>
  );
}

function RootNavigator() {
  const { accessToken, isLoading } = useAuth();

  useEffect(() => {
    console.log('RootNavigator: accessToken changed:', accessToken);
    console.log('RootNavigator: isLoading:', isLoading);
  }, [accessToken, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {accessToken == null ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} options={{ presentation: 'modal' }} />
        </>
      ) : (
        <Stack.Screen name="Calendar" component={CalendarScreen} />
      )}
      <Stack.Screen name="Transcription" component={TranscriptionScreen} />
    </Stack.Navigator>
  );
}

function AuthCallbackScreen() {
  console.log('AuthCallbackScreen: Rendered');
  useEffect(() => {
    console.log('AuthCallbackScreen: Attempting to dismiss browser...');
    WebBrowser.dismissAuthSession();
    WebBrowser.dismissBrowser();
  }, []);
  return null;
}