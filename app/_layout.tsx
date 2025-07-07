import { AuthProvider, useAuth } from "@/context/auth";
import { Slot, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React from "react";
import "react-native-reanimated";

SplashScreen.preventAutoHideAsync();

const InitialLayout = () => {
  const { accessToken, isLoading } = useAuth();
  const router = useRouter();
  // Track if the user has explicitly logged in in this session
  const [hasExplicitlyLoggedIn, setHasExplicitlyLoggedIn] = React.useState(false);

  // Debug print
  console.log("[InitialLayout] accessToken:", accessToken, "isLoading:", isLoading, "hasExplicitlyLoggedIn:", hasExplicitlyLoggedIn);

  // Listen for explicit login (accessToken changes from null to a value, but only if not restoring)
  React.useEffect(() => {
    if (!isLoading && accessToken && !hasExplicitlyLoggedIn) {
      // Only redirect if the user just signed in (not just because a token exists)
      setHasExplicitlyLoggedIn(true);
      router.replace("/CalendarScreen");
    }
    // If user signs out, reset hasExplicitlyLoggedIn
    if (!accessToken && hasExplicitlyLoggedIn) {
      setHasExplicitlyLoggedIn(false);
    }
  }, [accessToken, isLoading]);

  React.useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return <Slot />;
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <InitialLayout />
    </AuthProvider>
  );
}