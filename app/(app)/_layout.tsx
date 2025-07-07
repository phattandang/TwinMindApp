import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name = "index" options={{title: "Login" }} />
      <Stack.Screen name="CalendarScreen" options={{ title: "Calendar" }} />
      <Stack.Screen name="transcription" options={{ title: "Transcription" }} />
    </Stack>
  );
} 