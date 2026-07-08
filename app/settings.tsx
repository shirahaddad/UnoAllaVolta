import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useAuthStore, TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET } from '@/store/authStore';
import { useGoogleAuthStore, GOOGLE_CLIENT_ID } from '@/store/googleAuthStore';
import { getOAuthRedirectUri } from '@/utils/redirectUri';
import { useDeckStore } from '@/store/deckStore';
import { useSettingsStore } from '@/store/settingsStore';
import { fetchCalendarList, GoogleCalendar } from '@/services/googleCalendar';
import { fetchProjects, refreshTodoistToken, TodoistAuthError, TodoistProject } from '@/services/todoist';

function openWebOAuth(authUrl: string): Promise<{ code: string; state: string } | null> {
  return new Promise((resolve) => {
    localStorage.removeItem('oauth_result');
    const popup = (window as Window).open(authUrl, 'oauth', 'width=600,height=700,left=200,top=100');

    let done = false;
    function finish(result: { code: string; state: string } | null) {
      if (done) return;
      done = true;
      clearInterval(closedTimer);
      window.removeEventListener('storage', storageHandler);
      localStorage.removeItem('oauth_result');
      resolve(result);
    }

    function readResult(): { code: string; state: string } | null {
      try {
        const raw = localStorage.getItem('oauth_result');
        if (!raw) return null;
        const { code, state } = JSON.parse(raw);
        return code && state ? { code, state } : null;
      } catch {
        return null;
      }
    }

    const storageHandler = (event: StorageEvent) => {
      if (event.key === 'oauth_result') finish(readResult());
    };

    // Fallback: detect popup closed without storage event firing first
    const closedTimer = setInterval(() => {
      if (popup?.closed) finish(readResult());
    }, 300);

    window.addEventListener('storage', storageHandler);
  });
}

export default function SettingsScreen() {
  const router = useRouter();
  const { todoistToken, todoistRefreshToken, setTodoistToken, setTodoistRefreshToken } = useAuthStore();
  const handleTodoistConnect = async () => {
    const redirectUri = getOAuthRedirectUri();
    const authUrl =
      'https://todoist.com/oauth/authorize?' +
      new URLSearchParams({
        client_id: TODOIST_CLIENT_ID,
        scope: 'data:read_write',
        state: 'todoist',
        redirect_uri: redirectUri,
      }).toString();
    if (Platform.OS === 'web') {
      const result = await openWebOAuth(authUrl);
      if (result) router.push({ pathname: '/auth', params: result });
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, 'unoallavolta://auth');
    console.log('[settings] todoist auth result:', JSON.stringify(result));
    if (result.type === 'success') {
      const urlParams = new URLSearchParams(result.url.split('?')[1] ?? '');
      const code = urlParams.get('code');
      const oauthState = urlParams.get('state');
      if (code && oauthState) {
        router.push({ pathname: '/auth', params: { code, state: oauthState } });
      }
    }
  };

  const handleTodoistDisconnect = async () => {
    await setTodoistToken(null);
  };
  const { calendars: deckCalendars, todoistDisconnected, authErrorDetail, googleCalendarError } = useDeckStore();
  const { excludedProjectIds, toggleProject, excludedCalendarIds, toggleCalendar, resetDismissedCalendarEvents } = useSettingsStore();
  const { email: googleEmail, accessToken: googleAccessToken, clearTokens, getValidToken } = useGoogleAuthStore();
  const googleConnected = !!(googleAccessToken || googleEmail);

  const [reimportDone, setReimportDone] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      let projects;
      try {
        projects = await fetchProjects(todoistToken!);
      } catch (e) {
        // A 477 just means the access token expired mid-session, not that the
        // connection is actually broken — refresh once and retry before
        // surfacing an error, same as the deck's own fetch does.
        if (e instanceof TodoistAuthError && e.errorCode === 477 && todoistRefreshToken) {
          const refreshed = await refreshTodoistToken(todoistRefreshToken, TODOIST_CLIENT_ID, TODOIST_CLIENT_SECRET);
          if (!refreshed) throw e;
          await setTodoistToken(refreshed.accessToken);
          if (refreshed.refreshToken) await setTodoistRefreshToken(refreshed.refreshToken);
          projects = await fetchProjects(refreshed.accessToken);
        } else {
          throw e;
        }
      }
      setTestResult(`✓ OK — ${projects.length} project${projects.length === 1 ? '' : 's'}`);
    } catch (e) {
      setTestResult(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(false);
    }
  };
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [calendarsExpanded, setCalendarsExpanded] = useState(false);
  const [projectList, setProjectList] = useState<TodoistProject[]>([]);
  const [calendarList, setCalendarList] = useState<GoogleCalendar[]>(deckCalendars);
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const [calendarsError, setCalendarsError] = useState<string | null>(null);

  const handleGoogleConnect = async () => {
    const redirectUri = getOAuthRedirectUri();
    const authUrl =
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.readonly openid email',
        access_type: 'offline',
        prompt: 'consent',
        state: 'google',
      }).toString();
    if (Platform.OS === 'web') {
      const result = await openWebOAuth(authUrl);
      if (result) router.push({ pathname: '/auth', params: result });
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, 'unoallavolta://auth');
    console.log('[settings] google auth result:', JSON.stringify(result));
    if (result.type === 'success') {
      const urlParams = new URLSearchParams(result.url.split('?')[1] ?? '');
      const code = urlParams.get('code');
      const oauthState = urlParams.get('state');
      if (code && oauthState) {
        router.push({ pathname: '/auth', params: { code, state: oauthState } });
      }
    }
  };

  useEffect(() => {
    if (todoistToken) {
      fetchProjects(todoistToken).then(setProjectList).catch(console.error);
    } else {
      setProjectList([]);
    }
  }, [todoistToken]);

  useEffect(() => {
    if (!googleConnected) return;
    setCalendarsLoading(true);
    setCalendarsError(null);
    getValidToken()
      .then(async (token) => {
        if (!token) {
          setCalendarsError(useGoogleAuthStore.getState().authError || "Couldn't refresh Google session");
          return;
        }
        const cals = await fetchCalendarList(token);
        setCalendarList(cals);
      })
      .catch((e) => {
        console.error('[settings] calendar list fetch failed:', e);
        setCalendarsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setCalendarsLoading(false));
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
                  <View style={[styles.dot, todoistDisconnected && styles.errorDot]} />
                  <Text style={[styles.connectedText, todoistDisconnected && styles.errorText]}>
                    {todoistDisconnected ? 'Connection error' : 'Connected'}
                  </Text>
                </View>
                {todoistDisconnected && authErrorDetail && (
                  <Text style={styles.errorDetail} numberOfLines={3}>{authErrorDetail}</Text>
                )}
                {todoistDisconnected ? (
                  <TouchableOpacity style={styles.saveButton} onPress={handleTodoistConnect}>
                    <Text style={styles.saveButtonText}>Reconnect</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.disconnectButton}
                      onPress={handleTestConnection}
                      disabled={testing}
                    >
                      <Text style={styles.disconnectText}>{testing ? 'Testing…' : 'Test connection'}</Text>
                    </TouchableOpacity>
                    {testResult !== null && (
                      <Text style={styles.testResultText}>{testResult}</Text>
                    )}
                    <TouchableOpacity style={styles.disconnectButton} onPress={handleTodoistDisconnect}>
                      <Text style={styles.disconnectText}>Disconnect</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <TouchableOpacity style={styles.saveButton} onPress={handleTodoistConnect}>
                <Text style={styles.saveButtonText}>Connect Todoist</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* PROJECT SELECTION */}
          {todoistToken && projectList.length > 0 && (
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
                  {projectList.map((project) => {
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
                  <View style={[styles.dot, (calendarsError || googleCalendarError) && styles.errorDot]} />
                  <Text style={[styles.connectedText, (calendarsError || googleCalendarError) && styles.errorText]}>
                    {calendarsError || googleCalendarError ? 'Connection error' : 'Connected'}
                  </Text>
                </View>
                {(calendarsError || googleCalendarError) && (
                  <Text style={styles.errorDetail} numberOfLines={3}>{calendarsError || googleCalendarError}</Text>
                )}
                {(calendarsError || googleCalendarError) && (
                  <TouchableOpacity style={styles.saveButton} onPress={handleGoogleConnect}>
                    <Text style={styles.saveButtonText}>Reconnect</Text>
                  </TouchableOpacity>
                )}
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
          {googleConnected && (calendarsLoading || calendarList.length > 0) && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setCalendarsExpanded(v => !v)}
              >
                <Text style={styles.sectionLabel}>CALENDARS</Text>
                {calendarsLoading ? (
                  <ActivityIndicator size="small" color="#8A8A8A" />
                ) : (
                  <Ionicons
                    name={calendarsExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#8A8A8A"
                  />
                )}
              </TouchableOpacity>
              {calendarsExpanded && !calendarsLoading && (
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
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
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
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
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
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
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
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  errorDot: {
    backgroundColor: '#E05C5C',
  },
  errorText: {
    color: '#E05C5C',
  },
  errorDetail: {
    fontSize: 11,
    color: '#555',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  testResultText: {
    fontSize: 13,
    color: '#8A8A8A',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
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
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
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
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
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
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  chipTextActive: {
    color: '#0F0F0F',
    fontWeight: '600',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
});
