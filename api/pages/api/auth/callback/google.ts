import { NextRequest, NextResponse } from 'next/server';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "../../../../../shared/constants";

export default async function handler(request: NextRequest) {
  console.log('DEBUG: Callback received at /api/auth/callback/google:', request.url);

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  console.log('DEBUG: Received code:', code);
  console.log('DEBUG: Received state:', state);

  if (!code || !state) {
    console.error('ERROR: Missing code or state');
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  try {
    console.log('DEBUG: Attempting token exchange with Google...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.EXPO_PUBLIC_BASE_URL}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    console.log('DEBUG: Token response status:', tokenResponse.status);
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('ERROR: Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    console.log('DEBUG: Tokens received:', tokens);
    const accessToken = tokens.access_token;

    // For backend testing, return a response instead of redirecting to Expo
    return NextResponse.json({ access_token: accessToken, state }, { status: 200 });
  } catch (e: any) {
    console.error('ERROR in callback:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const config = {
  runtime: 'edge',
};