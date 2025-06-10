import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Button, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/auth';
import { RootStackParamList } from './App';

type CalendarEvent = {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

export default function CalendarScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Calendar'>) {
  const { userInfo, fetchWithAuth } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true);
        const now = new Date().toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&singleEvents=true&orderBy=startTime&maxResults=20`;
        const resp = await fetchWithAuth(url, { method: 'GET' });
        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`Failed to fetch calendar events: ${resp.status} - ${errorText}`);
        }
        const json = await resp.json();
        setEvents(json.items || []);
      } catch (e: any) {
        console.error('Error fetching calendar events:', e);
        setError(e.message || 'Failed to fetch events. Check your access token or network.');
      } finally {
        setLoading(false);
      }
    }
    if (userInfo) {
      fetchEvents();
    }
  }, [userInfo, fetchWithAuth]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading events...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Upcoming Events</Text>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EventCard event={item} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No upcoming events found.</Text>}
      />
      <Button
        title="Next"
        onPress={() => navigation.navigate('Transcription')}
        color="#708090"
      />
    </SafeAreaView>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  const startTime = event.start.dateTime
    ? new Date(event.start.dateTime).toLocaleString()
    : event.start.date
    ? new Date(event.start.date).toLocaleDateString()
    : 'No start time';
  const endTime = event.end.dateTime
    ? new Date(event.end.dateTime).toLocaleString()
    : event.end.date
    ? new Date(event.end.date).toLocaleDateString()
    : 'No end time';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{event.summary || '(No title)'}</Text>
      <Text style={styles.time}>Start: {startTime}</Text>
      <Text style={styles.time}>End: {endTime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  emptyText: { textAlign: 'center', color: '#666', marginTop: 50 },
  errorText: { color: 'red', textAlign: 'center' },
  card: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: '500' },
  time: { fontSize: 14, color: '#555', marginTop: 4 },
});