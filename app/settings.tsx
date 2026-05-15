import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '@/store/authStore';
import { useGoogleAuthStore, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '@/store/googleAuthStore';
import { useDeckStore } from '@/store/deckStore';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchCalendarList, GoogleCalendar } from '@/services/googleCalendar';

const REDIRECT_URI = 'https://shirahaddad.github.io/UnoAllaVolta/auth.html';

export default function SettingsScreen() {
  const router = useRouter();
  const { todoistToken, setTodoistToken } = useAuthStore();
  const { projects, calendars: deckCalendars } = useDeckStore();
  const { excludedProjectIds, toggleProject, excludedCalendarIds, toggleCalendar } = useSettingsStore();
  const { email: googleEmail, setTokens, clearTokens, getValidToken } = useGoogleAuthStore();

  const [draft, setDraft] = useState('');
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [calendarsExpanded, setCalendarsExpanded] = useState(false);
  const [calendarList, setCalendarList] = useState<GoogleCalendar[]>(deckCalendars);

  const handleGoogleConnect = async () => {
    const authUrl =
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        access_type: 'offline',
        prompt: 'consent',
      }).toString();

    const result = await WebBrowser.openAuthSessionAsync(authUrl, 'unoallavolta://auth');
    if (result.type !== 'success') return;

    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    if (!code) return;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return;

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    await setTokens({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? '',
      expiresIn: tokenData.expires_in ?? 3600,
      email: userData.email ?? '',
    });

    const token = await getValidToken();
    if (token) {
      const cals = await fetchCalendarList(token);
      setCalendarList(cals);
    }
  };

  useEffect(() => {
    if (googleEmail) {
      getValidToken().then(async (token) => {
        if (token) {
          const cals = await fetchCalendarList(token);
          setCalendarList(cals);
        }
      });
    }
  }, [googleEmail]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await setTodoistToken(trimmed);
    setDraft('');
  };

  const handleDisconnect = async () => {
    await setTodoistToken(null);
  };

  const handleGoogleDisconnect = async () => {
    await clearTokens();
    setCalendarList([]);
  };

  const maskedToken = todoistToken
    ? todoistToken.slice(0, 6) + '••••••••••••••••' + todoistToken.slice(-4)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#F0EFEB" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* TODOIST */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TODOIST</Text>
            {todoistToken ? (
              <View style={styles.box}>
                <View style={styles.connectedRow}>
                  <View style={styles.dot} />
                  <Text style={styles.connectedText}>Connected</Text>
                </View>
                <Text style={styles.maskedToken}>{maskedToken}</Text>
                <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.box}>
                <Text style={styles.inputLabel}>API Token</Text>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Paste your token here"
                  placeholderTextColor="#3A3A3A"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.hint}>
                  Todoist → Settings → Integrations → Developer → API token
                </Text>
                <TouchableOpacity
                  style={[styles.saveButton, !draft.trim() && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={!draft.trim()}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* PROJECT SELECTION */}
          {todoistToken && projects.length > 0 && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setProjectsExpanded(v => !v)}
              >
                <Text style={styles.sectionLabel}>PROJECTS</Text>
                <Ionicons
                  name={projectsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#8A8A8A"
                />
              </TouchableOpacity>
              {projectsExpanded && (
                <View style={styles.chipContainer}>
                  {projects.map((project) => {
                    const included = !excludedProjectIds.includes(project.id);
                    return (
                      <TouchableOpacity
                        key={project.id}
                        style={[styles.chip, included && styles.chipActive]}
                        onPress={() => toggleProject(project.id)}
                      >
                        <Text style={[styles.chipText, included && styles.chipTextActive]}>
                          {project.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* GOOGLE CALENDAR */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>GOOGLE CALENDAR</Text>
            {googleEmail ? (
              <View style={styles.box}>
                <View style={styles.connectedRow}>
                  <View style={styles.dot} />
                  <Text style={styles.connectedText}>Connected</Text>
                </View>
                <TouchableOpacity style={styles.disconnectButton} onPress={handleGoogleDisconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleGoogleConnect}
              >
                <Text style={styles.saveButtonText}>Connect Google Calendar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* CALENDAR SELECTION */}
          {googleEmail && calendarList.length > 0 && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setCalendarsExpanded(v => !v)}
              >
                <Text style={styles.sectionLabel}>CALENDARS</Text>
                <Ionicons
                  name={calendarsExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#8A8A8A"
                />
              </TouchableOpacity>
              {calendarsExpanded && (
                <View style={styles.chipContainer}>
                  {calendarList.map((cal) => {
                    const included = !excludedCalendarIds.includes(cal.id);
                    return (
                      <TouchableOpacity
                        key={cal.id}
                        style={[styles.chip, included && styles.chipActive]}
                        onPress={() => toggleCalendar(cal.id)}
                      >
                        <Text style={[styles.chipText, included && styles.chipTextActive]}>
                          {cal.summary}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F0EFEB',
  },
  scrollContent: {
    paddingBottom: 40,
    gap: 32,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8A8A',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  box: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 20,
    gap: 12,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A9BAF',
  },
  connectedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F0EFEB',
  },
  maskedToken: {
    fontSize: 13,
    color: '#8A8A8A',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  disconnectButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 4,
  },
  disconnectText: {
    fontSize: 14,
    color: '#8A8A8A',
  },
  inputLabel: {
    fontSize: 13,
    color: '#8A8A8A',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#F0EFEB',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hint: {
    fontSize: 12,
    color: '#8A8A8A',
    lineHeight: 18,
  },
  saveButton: {
    backgroundColor: '#4A9BAF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F0F',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  chipActive: {
    backgroundColor: '#4A9BAF',
    borderColor: '#4A9BAF',
  },
  chipText: {
    fontSize: 13,
    color: '#8A8A8A',
  },
  chipTextActive: {
    color: '#0F0F0F',
    fontWeight: '600',
  },
});
