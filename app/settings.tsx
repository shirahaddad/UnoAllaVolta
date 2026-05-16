import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore, TODOIST_CLIENT_ID } from '@/store/authStore';
import { useGoogleAuthStore, GOOGLE_CLIENT_ID } from '@/store/googleAuthStore';
import { useDeckStore } from '@/store/deckStore';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchCalendarList, GoogleCalendar } from '@/services/googleCalendar';

const REDIRECT_URI = 'https://shirahaddad.github.io/UnoAllaVolta/auth.html';

export default function SettingsScreen() {
  const router = useRouter();
  const { todoistToken, setTodoistToken } = useAuthStore();
  const handleTodoistConnect = async () => {
    const authUrl =
      'https://todoist.com/oauth/authorize?' +
      new URLSearchParams({
        client_id: TODOIST_CLIENT_ID,
        scope: 'data:read,data:read_write',
        state: 'todoist',
        redirect_uri: REDIRECT_URI,
      }).toString();
    const result = await WebBrowser.openBrowserAsync(authUrl);
    console.log('[settings] todoist browser result:', JSON.stringify(result));
  };

  const handleTodoistDisconnect = async () => {
    await setTodoistToken(null);
  };
  const { projects, calendars: deckCalendars } = useDeckStore();
  const { excludedProjectIds, toggleProject, excludedCalendarIds, toggleCalendar, resetDismissedCalendarEvents } = useSettingsStore();
  const { email: googleEmail, accessToken: googleAccessToken, clearTokens, getValidToken } = useGoogleAuthStore();
  const googleConnected = !!(googleAccessToken || googleEmail);

  const [reimportDone, setReimportDone] = useState(false);
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
        scope: 'https://www.googleapis.com/auth/calendar.readonly openid email',
        access_type: 'offline',
        prompt: 'consent',
        state: 'google',
      }).toString();
    await WebBrowser.openBrowserAsync(authUrl);
  };

  useEffect(() => {
    if (googleConnected) {
      getValidToken().then(async (token) => {
        if (token) {
          const cals = await fetchCalendarList(token);
          setCalendarList(cals);
        }
      });
    }
  }, [googleConnected]);

  const handleGoogleDisconnect = async () => {
    await clearTokens();
    setCalendarList([]);
  };

  const handleResetCalendarEvents = async () => {
    await resetDismissedCalendarEvents();
    setReimportDone(true);
    setTimeout(() => setReimportDone(false), 1500);
  };

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
                <TouchableOpacity style={styles.disconnectButton} onPress={handleTodoistDisconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.saveButton} onPress={handleTodoistConnect}>
                <Text style={styles.saveButtonText}>Connect Todoist</Text>
              </TouchableOpacity>
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
            {googleConnected ? (
              <View style={styles.box}>
                <View style={styles.connectedRow}>
                  <View style={styles.dot} />
                  <Text style={styles.connectedText}>Connected</Text>
                </View>
                <TouchableOpacity style={styles.disconnectButton} onPress={handleGoogleDisconnect}>
                  <Text style={styles.disconnectText}>Disconnect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.disconnectButton} onPress={handleResetCalendarEvents}>
                  <Text style={[styles.disconnectText, reimportDone && { color: '#4A9BAF' }]}>
                    {reimportDone ? 'Done ✓' : 'Re-import all events'}
                  </Text>
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
          {googleConnected && calendarList.length > 0 && (
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
  saveButton: {
    backgroundColor: '#4A9BAF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
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
