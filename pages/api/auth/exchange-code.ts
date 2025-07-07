import { NextApiRequest, NextApiResponse } from 'next';
import { GOOGLE_CLIENT_SECRET, WEB_CLIENT_ID } from "../../../shared/constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: WEB_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://auth.expo.io/@dangtanphat/TwinMindApp', // Must match the one used in the client
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return res.status(500).json({ error: 'Token exchange failed', details: errorText });
    }

    const tokens = await tokenResponse.json();
    return res.status(200).json({ access_token: tokens.access_token });
    
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}