import * as jose from "jose";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  JWT_SECRET
} from "../../../shared/constants";

export async function POST(request: Request) {
  const formData = await request.formData() as unknown as FormData;
  const code = formData.get('code')?.toString() ?? '';
  const platform = formData.get('platform')?.toString() ?? 'native'; // Default to native if not specified

  if (!code) {
    return Response.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
      code: code,
    }),
  });

  const data = await response.json();

  if (!data.id_token) {
    return Response.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  }

  const userInfo = jose.decodeJwt(data.id_token) as object;

  // Create a new object without the exp property from the original token
  const { exp, ...userInfoWithoutExp } = userInfo as any;

  // User id
  const sub = (userInfo as { sub: string }).sub;

  // Current timestamp in seconds
  const issuedAt = Math.floor(Date.now() / 1000);

  // Generate a unique jti (JWT ID) for the refresh token
  const jti = crypto.randomUUID();

  // Create access token (short-lived)
  const accessToken = await new jose.SignJWT(userInfoWithoutExp)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt(issuedAt)
    .sign(new TextEncoder().encode(JWT_SECRET));

  // Create refresh token (long-lived)
  const refreshToken = await new jose.SignJWT({
    sub,
    jti, // Include a unique ID for this refresh token
    type: "refresh",
    // Include all user information in the refresh token
    // This ensures we have the data when refreshing tokens
    name: (userInfo as any).name,
    email: (userInfo as any).email,
    picture: (userInfo as any).picture,
    given_name: (userInfo as any).given_name,
    family_name: (userInfo as any).family_name,
    email_verified: (userInfo as any).email_verified,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAt)
    .sign(new TextEncoder().encode(JWT_SECRET));

  if (data.error) {
    return Response.json(
      {
        error: data.error,
        error_description: data.error_description,
        message: "OAuth validation error",
      },
      {
        status: 400,
      }
    );
  }

  // Handle web platform with cookies
  if (platform === "web") {
    // Create a response with the token in the body
    const response = Response.json({
      success: true,
      issuedAt: issuedAt,
    });


    return response;
  }

  // For native platforms, return both tokens in the response body
  return Response.json({
    accessToken,
    refreshToken,
    user: {
      id: sub,
      email: (userInfo as any).email,
      name: (userInfo as any).name,
      picture: (userInfo as any).picture,
      email_verified: (userInfo as any).email_verified,
    }
  });
}