import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { OPENAI_API_KEY } from './../shared/constants';


const QUEUE_KEY = '@audioChunkQueue';

type AudioChunk = { uri: string; timestamp: number };
type ChatMessage = { role: 'user' | 'assistant'; text: string };

export default function TranscriptionScreen() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [segmentsText, setSegmentsText] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const segmentTimer = useRef<number | null>(null);
  const [meetingSummary, setMeetingSummary] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);

  const enqueueChunk = async (uri: string) => {
    console.log('enqueueChunk called - Implementation needed', uri);
    try {
      const rawQueue = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
      const queue: AudioChunk[] = JSON.parse(rawQueue);
      queue.push({ uri, timestamp: Date.now() });
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Error enqueuing chunk:', e);
    }
  };

  const flushQueue = async () => {
    if (isFlushing) return;
    setIsFlushing(true);

    try {
      const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
      let queue: AudioChunk[] = JSON.parse(raw);
      const remaining: AudioChunk[] = [];

      for (const chunk of queue) {
        try {
          const transcript = await transcribeWithOpenAI(chunk.uri);
          setSegmentsText((prev: string[]) => [...prev, transcript]);
          await FileSystem.deleteAsync(chunk.uri, { idempotent: true });
          await new Promise((r) => setTimeout(r, 3000));
        } catch (err: any) {
          if (err.message === 'insufficient_quota') {
            Alert.alert(
              'OpenAI Quota Exceeded',
              "You've exceeded your OpenAI quota. Please check your account's billing or plan."
            );
            remaining.push(...queue.slice(queue.indexOf(chunk)));
            break;
          }
          if (err.message.includes('Max retries exceeded')) {
            console.warn('Max retries exceeded for chunk, pushing back to queue:', chunk.uri);
            remaining.push(chunk);
          } else {
            console.warn('Dropping chunk due to unexpected error:', err, chunk.uri);
          }
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } catch (e) {
      console.error('Error flushing queue:', e);
    } finally {
      setIsFlushing(false);
    }
  };

  const startMeeting = async () => {
    console.log('startMeeting called');
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission not granted', 'Please grant audio recording permission to start a meeting.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      setRecording(newRecording);
      setIsRecording(true);
      setSegmentsText([]);
      setChatMessages([]);
      setMeetingSummary(null);

      segmentTimer.current = setInterval(async () => {
        if (newRecording) {
          await processSegment(newRecording, false);
        }
      }, 10000) as any;
    } catch (e) {
      console.error('Failed to start recording', e);
      setIsRecording(false);
      Alert.alert('Recording Error', 'Failed to start recording.');
    }
  };

  const processSegment = async (rec: Audio.Recording, isFinal: boolean) => {
    console.log('processSegment called', isFinal);
    try {
      const status = await rec.getStatusAsync();
      if (!status.isRecording && !isFinal) {
        console.log('processSegment: Recording stopped unexpectedly, not final segment. Skipping.');
        return;
      }

      if (isFinal) {
        await rec.stopAndUnloadAsync();
      } else {
        const currentURI = rec.getURI();
        if (!currentURI) {
          console.warn('processSegment: No URI for current recording segment. Skipping.');
          if (!isFinal) stopMeeting();
          return;
        }

        await rec.stopAndUnloadAsync();
        const nextRecording = new Audio.Recording();
        await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await nextRecording.startAsync();
        setRecording(nextRecording);
        await enqueueChunk(currentURI);

        const net = await NetInfo.fetch();
        if (net.isConnected) {
          await flushQueue();
        }
      }
    } catch (e) {
      console.error('Error in processSegment:', e);
      if (!isFinal) stopMeeting();
    }
  };

  const stopMeeting = async () => {
    console.log('stopMeeting called');
    if (segmentTimer.current) {
      clearInterval(segmentTimer.current);
      segmentTimer.current = null;
    }

    if (recording) {
      try {
        await processSegment(recording, true);
      } catch (e) {
        console.error('Error stopping & unloading recording:', e);
      } finally {
        setRecording(null);
        setIsRecording(false);
      }
    } else {
      setIsRecording(false);
    }

    console.log('Stopping meeting, forcing queue flush...');
    await flushQueue();
    console.log('Queue flush complete.');

    console.log('Generating summary...');
    await generateSummary();
    console.log('Summary generation triggered.');
  };

  const transcribeWithOpenAI = async (fileUri: string): Promise<string> => {
    console.log('Transcribing file:', fileUri);
    const maxRetries = 2;
    let retryCount = 0;
    let delay = 2000;

    while (retryCount < maxRetries) {
      try {
        const response = await fetch(fileUri);
        if (!response.ok) {
          throw new Error(`File fetch error: ${response.status} for URI ${fileUri}`);
        }
        const blob = await response.blob();
        const form = new FormData();
        form.append('file', blob, 'segment.m4a');
        form.append('model', 'whisper-1');

        console.log('Sending transcription request to OpenAI...');
        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: form as any,
        });
        console.log('Received transcription response status:', res.status);

        if (res.status === 401 || res.status === 403) {
          const errJson = await res.json().catch(() => ({ message: 'Unknown authentication error' }));
          if (errJson.error?.code === 'insufficient_quota') {
            throw new Error('insufficient_quota');
          }
          console.error(`OpenAI 4xx error: ${res.status}`, errJson);
          if (res.status === 401) throw new Error('Invalid OpenAI API Key');
          if (res.status === 403) throw new Error('Forbidden OpenAI request');
          throw new Error(`OpenAI API error: ${res.status}`);
        }
        if (res.status === 429) {
          console.warn(`Whisper rate limited (${res.status}) — retrying attempt ${retryCount + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          retryCount++;
          delay *= 2;
          continue;
        }
        if (res.status >= 500 && res.status < 600) {
          console.warn(`Whisper server error (${res.status}) — retrying attempt ${retryCount + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          retryCount++;
          delay *= 2;
          continue;
        }
        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Unknown error');
          console.error(`Whisper HTTP error: ${res.status} - ${errorText}`);
          throw new Error(`Whisper HTTP error: ${res.status}`);
        }

        const json = await res.json();
        console.log('Transcription successful.');
        return json.text as string;
      } catch (error: any) {
        console.error(`Transcription attempt ${retryCount + 1}/${maxRetries} failed:`, error.message);
        if (error.message === 'insufficient_quota' || error.message.includes('Invalid OpenAI API Key') || error.message.includes('Forbidden OpenAI request')) {
          throw error;
        }
        if (retryCount < maxRetries - 1) {
          retryCount++;
          await new Promise((r) => setTimeout(r, delay));
          delay *= 2;
          continue;
        } else {
          console.error('Max retries exceeded for transcription.', error);
          throw new Error('Max retries exceeded for transcription');
        }
      }
    }
    throw new Error('Transcription failed after multiple retries');
  };

  const generateSummary = async () => {
    console.log('generateSummary called');
    try {
      const transcriptContext = segmentsText.join('\n\n');
      if (!transcriptContext) {
        setMeetingSummary('No transcript available to summarize.');
        console.log('No transcript available to summarize.');
        return;
      }

      console.log('Transcript length for summary:', transcriptContext.length);
      const summaryPrompt = [
        {
          role: 'system' as const,
          content:
            'You are a very helpful AI assistant. The user has provided a transcript of a meeting. ' +
            'Please generate a concise, bullet‐point summary, with speakers identified if possible.',
        },
        {
          role: 'user' as const,
          content: `Here is the full meeting transcript:\n\n${transcriptContext}\n\nPlease summarize the key takeaways, decisions, and action items in 5–7 bullet points.`,
        },
      ];

      console.log('Sending summary request to OpenAI...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          temperature: 0.2,
          stream: false,
          messages: summaryPrompt,
        }),
      });
      console.log('Received summary response status:', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error(`Summary API error: ${response.status} - ${text}`);
        throw new Error(`Summary API ${response.status}: ${text}`);
      }

      const json = await response.json();
      const summaryText = json.choices?.[0]?.message?.content?.trim() || 'No summary returned.';
      setMeetingSummary(summaryText);
      console.log('Summary generated successfully.');
    } catch (e: any) {
      console.error('Error generating summary:', e);
      setMeetingSummary('Failed to generate summary. Please try again.');
      Alert.alert('Summary Error', 'Failed to generate meeting summary.');
    }
  };

  const sendChatQuery = async () => {
    console.log('sendChatQuery called');
    const query = userQuery.trim();
    if (!query) return;

    setChatMessages((prev: ChatMessage[]) => [...prev, { role: 'user', text: query }]);
    setUserQuery('');
    setIsChatStreaming(true);

    const transcriptContext = segmentsText.join('\n\n');
    const contextToSend =
      transcriptContext.length > 4000
        ? '... (transcript truncated) ...\n\n' + transcriptContext.slice(-4000)
        : transcriptContext;

    const systemMessage = {
      role: 'system' as const,
      content: `You are a helpful assistant. The following is the transcript of a meeting:\n\n${contextToSend}`,
    };
    const userMessage = { role: 'user' as const, content: query };

    const maxChatRetries = 2;
    let attempt = 0;
    let backoff = 1000;

    while (attempt <= maxChatRetries) {
      try {
        console.log(`Sending chat request to OpenAI (Attempt ${attempt + 1}/${maxChatRetries + 1})...`);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            stream: true,
            messages: [systemMessage, userMessage],
          }),
        });
        console.log('Received chat response status:', response.status);

        if (response.status === 401 || response.status === 403) {
          const errJson = await response.json().catch(() => ({ message: 'Unknown authentication error' }));
          if (errJson.error?.code === 'insufficient_quota') {
            Alert.alert('OpenAI Quota Exceeded', "You've exceeded your OpenAI quota. Please check your billing details.");
            setIsChatStreaming(false);
            return;
          }
          console.error(`Chat API authentication/forbidden error: ${response.status}`, errJson);
          if (response.status === 401) Alert.alert('Chat Error', 'Invalid OpenAI API Key.');
          else if (response.status === 403) Alert.alert('Chat Error', 'Forbidden OpenAI request.');
          else Alert.alert('Chat Error', errJson.message || 'An authentication error occurred.');
          setIsChatStreaming(false);
          return;
        }

        if (response.status === 429) {
          console.warn(`Chat rate limited (${response.status}) — retrying attempt ${attempt + 1}/${maxChatRetries + 1} after ${backoff}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
          backoff *= 2;
          attempt++;
          continue;
        }

        if (!response.ok) {
          const txt = await response.text().catch(() => 'Unknown error body');
          console.error(`Chat HTTP error: ${response.status} - ${txt}`);
          Alert.alert('Chat Error', `API error: ${response.status}. Please try again.`);
          setIsChatStreaming(false);
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder('utf-8');
        let assistantMessage = '';
        const parser = createParser({
          onEvent: (event: EventSourceMessage) => {
            const data = event.data;
            if (data === '[DONE]') {
              setChatMessages((prev: ChatMessage[]) => [
                ...prev,
                { role: 'assistant', text: assistantMessage },
              ]);
              setIsChatStreaming(false);
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                assistantMessage += delta;
                setChatMessages((prev: ChatMessage[]) => {
                  const copy = [...prev];
                  if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
                    copy[copy.length - 1].text = assistantMessage;
                  } else {
                    copy.push({ role: 'assistant', text: assistantMessage });
                  }
                  return copy;
                });
              }
            } catch (e) {
              console.error('JSON parse error in streaming chunk', e);
            }
          },
        });

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          parser.feed(chunk);
        }

        console.log('Chat stream completed successfully.');
        return;
      } catch (err: any) {
        console.error(`Chat fetch or streaming error (Attempt ${attempt + 1}/${maxChatRetries + 1}):`, err);
        if (err.message.includes('Invalid OpenAI API Key') || err.message.includes('Forbidden OpenAI request') || err.message.includes('API error:')) {
          setIsChatStreaming(false);
          return;
        }
        if (err.message.includes('insufficient_quota')) {
          Alert.alert('Chat Error', 'OpenAI quota exceeded.');
          setIsChatStreaming(false);
          return;
        }
        if (attempt < maxChatRetries) {
          attempt++;
          if (!err.message.includes('Rate limited')) {
            await new Promise((r) => setTimeout(r, backoff));
            backoff *= 2;
          }
          continue;
        } else {
          console.error('Max retries exceeded for chat request.', err);
          Alert.alert('Chat Error', err.message || 'Failed to get a response after multiple retries.');
          setIsChatStreaming(false);
          return;
        }
      }
    }
    console.error('Chat function completed unexpectedly without returning.');
    setIsChatStreaming(false);
  };

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        flushQueue();
      }
    });
    flushQueue();
    return () => unsub();
  }, []);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.header}>Real-Time Transcript + Chat</Text>
        <Button
          title={isRecording ? 'Stop Meeting' : 'Start Meeting'}
          onPress={isRecording ? stopMeeting : startMeeting}
          color={isRecording ? '#E33' : '#393'}
        />
        {isFlushing && (
          <View style={styles.flushing}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.flushingText}>Syncing audio…</Text>
          </View>
        )}
        <ScrollView style={styles.transcriptLog}>
          {segmentsText.map((txt, i) => (
            <Text key={i} style={styles.segmentText}>
              {txt}
            </Text>
          ))}
        </ScrollView>
        <View style={styles.divider} />
        <Text style={styles.chatHeader}>Interactive Chat</Text>
        <ScrollView style={styles.chatLog}>
          {chatMessages.map((m, idx) => (
            <View key={idx} style={m.role === 'user' ? styles.userBubble : styles.assistantBubble}>
              <Text style={m.role === 'user' ? styles.userText : styles.assistantText}>{m.text}</Text>
            </View>
          ))}
          {isChatStreaming && (
            <View style={styles.assistantBubble}>
              <ActivityIndicator size="small" color="#555" />
            </View>
          )}
        </ScrollView>
        {meetingSummary !== null && (
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryHeader}>Meeting Summary</Text>
            <ScrollView style={styles.summaryScroll}>
              <Text style={styles.summaryText}>{meetingSummary}</Text>
            </ScrollView>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={userQuery}
            onChangeText={setUserQuery}
            placeholder="Ask about the meeting..."
          />
          <TouchableOpacity
            onPress={sendChatQuery}
            style={styles.sendButton}
            disabled={isChatStreaming} // Only disable during chat streaming
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#FFF', paddingTop: 50 },
  header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  flushing: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 16 },
  flushingText: { marginLeft: 8, fontSize: 14, color: '#333' },
  transcriptLog: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  segmentText: { marginBottom: 12, fontSize: 16, lineHeight: 22, color: '#111' },
  divider: { height: 1, backgroundColor: '#CCC', marginVertical: 12 },
  chatHeader: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  chatLog: { flex: 1, marginBottom: 16 },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#DCF8C6',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    maxWidth: '80%',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECECEC',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    maxWidth: '80%',
  },
  userText: { color: '#000' },
  assistantText: { color: '#000' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, marginBottom: 16 },
  input: {
    flex: 1,
    height: 44,
    borderColor: '#CCC',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#708090',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  sendButtonText: { color: '#FFF', fontWeight: '600' },
  summaryContainer: {
    marginTop: 12,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
  },
  summaryHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  summaryScroll: { maxHeight: 150 },
  summaryText: { fontSize: 14, lineHeight: 20, color: '#333' },
});