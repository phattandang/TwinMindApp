import { useAuth } from "@/context/auth";
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function HomeScreen() {
  const { userInfo, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!userInfo) {
    return <Redirect href={"Login" as any} />;
  }

  return <Redirect href={"CalendarScreen" as any} />;
}