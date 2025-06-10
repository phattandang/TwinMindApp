import { APP_SCHEME, GOOGLE_AUTH_URL, GOOGLE_CLIENT_ID } from "../../../../shared/constants";

export default async function handler(request: Request) {
  if (!GOOGLE_CLIENT_ID) {
    return Response.json({ error: "Missing GOOGLE_CLIENT_ID environment variable" }, { status: 500 });
  }

  const url = new URL(request.url);
  const originalRedirectUri = url.searchParams.get("redirect_uri");
  const internalClient = url.searchParams.get("client_id");
  const state = url.searchParams.get("state");

  console.log('DEBUG: Incoming redirect_uri:', originalRedirectUri);
  console.log('DEBUG: Incoming state:', state);

  if (!originalRedirectUri || !internalClient || !state) {
    return Response.json({ error: "Missing required parameters" }, { status: 400 });
  }

  if (!APP_SCHEME) {
    return Response.json({ error: "Missing APP_SCHEME environment variable" }, { status: 500 });
  }
  const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return Response.json({ error: "Missing EXPO_PUBLIC_BASE_URL environment variable" }, { status: 500 });
  }

  const allowedRedirectUris = [APP_SCHEME, `${baseUrl}/api/auth/callback/google`];
  console.log("allowedRURI: ", allowedRedirectUris);
  if (!allowedRedirectUris.some(uri => originalRedirectUri.startsWith(uri))) {
    return Response.json({ error: "Invalid redirect_uri" }, { status: 400 });
  }

  const platform = originalRedirectUri.startsWith(APP_SCHEME) ? "mobile" : "web";
  const combinedState = `${platform}|${state}`;

  let idpClientId;
  if (internalClient === "google") {
    idpClientId = GOOGLE_CLIENT_ID;
  } else {
    return Response.json({ error: "Invalid client" }, { status: 400 });
  }

  const params = new URLSearchParams({
    client_id: idpClientId,
    redirect_uri: `${baseUrl}/api/auth/callback/google`,
    response_type: "code",
    scope: url.searchParams.get("scope") || "openid profile email",
    state: combinedState,
    prompt: "select_account",
  });

  console.log('DEBUG: Redirecting to Google with URL:', `${GOOGLE_AUTH_URL}?${params.toString()}`);

  return Response.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

export const config = {
  runtime: 'edge',
};