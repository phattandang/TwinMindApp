module.exports = {
    reactStrictMode: true,
    env: {
      APP_SCHEME: process.env.NEXT_PUBLIC_APP_SCHEME,
      EXPO_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_EXPO_PUBLIC_BASE_URL,
      GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      GOOGLE_AUTH_URL: process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL,
    },
    serverRuntimeConfig: {
      port: 8081,
    },
  };