// Google OAuth Constants
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
export const GOOGLE_REDIRECT_URI = process.env.EXPO_PUBLIC_BASE_URL ? `${process.env.EXPO_PUBLIC_BASE_URL}/api/auth/callback/google` : '';
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Apple OAuth Constants
export const APPLE_CLIENT_ID = "com.beto.expoauthexample.web";
export const APPLE_CLIENT_SECRET = process.env.APPLE_CLIENT_SECRET ?? '';
export const APPLE_REDIRECT_URI = process.env.EXPO_PUBLIC_BASE_URL ? `${process.env.EXPO_PUBLIC_BASE_URL}/api/auth/apple/callback` : '';
export const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";

// Environment Constants
export const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? 'http://localhost:8081';
export const APP_SCHEME = process.env.EXPO_PUBLIC_SCHEME ?? 'twinmind';
export const JWT_SECRET = process.env.JWT_SECRET ?? 'your-secret-key';

export const COOKIE_NAME = 'auth-token';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;