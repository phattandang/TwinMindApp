export const TOKEN_KEY_NAME = 'accessToken';

export const GOOGLE_CLIENT_ID  = process.env.GOOGLE_CLIENT_ID;
export const GOOGLE_CLIENT_SECRET= process.env.GOOGLE_CLIENT_SECRET;
export const ANDROID_CLIENT_ID= process.env.ANDROID_CLIENT_ID;
export const GOOGLE_REDIRECT_URI = `${process.env.EXPO_PUBLIC_BASE_URL}/api/auth/callback/google`;
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'your-secret-key';

export const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL;
export const APP_SCHEME = process.env.EXPO_PUBLIC_SCHEME;
