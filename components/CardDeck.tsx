import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDeckStore } from '@/store/deckStore';
import { useAuthStore } from '@/store/authStore';
import { useGoogleAuthStore } from '@/store/googleAuthStore';
import { FlipCard } from './FlipCard';
import { ProgressBar } from './ProgressBar';
import { EmptyState } from './EmptyState';
import { AddTaskModal } from './AddTaskModal';

export function CardDeck() {
  const router = useRouter();
  const { todoistToken, tokenFoundInStorage, setTodoistToken } = useAuthStore();
  const { accessToken: googleAccessToken, email: googleEmail } = useGoogleAuthStore();
  const googleConnected = !!(googleAccessToken || googleEmail);
  const { queue, isLoading, error, authErrorDetail, todoistDisconnected, pendingUndo, markDone, commitPendingUndo, cancelPendingUndo, moveLater, rescheduleTomorrow, fetchCards } = useDeckStore();

  useFocusEffect(
    useCallback(() => {
      if (todoistToken || googleConnected) fetchCards(todoistToken);
    }, [todoistToken, googleConnected])
  );

  const current = queue[0];
  const [laterSeq, setLaterSeq] = useState(0);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showRescheduledToast, setShowRescheduledToast] = useState(false);
  const rescheduledTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingUndo) {
      timerRef.current = setTimeout(() => {
        commitPendingUndo();
        timerRef.current = null;
      }, 3000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pendingUndo?.id]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchCards(todoistToken);
    setIsRefreshing(false);
  }, [fetchCards, todoistToken]);

  function renderBody() {
    if (!todoistToken && !googleConnected) {
      return (
        <View style={styles.centered}>
          <Ionicons name="link-outline" size={40} color="#2A2A2A" />
          <Text style={styles.emptyHeading}>No account connected</Text>
          <Text style={styles.emptyHint}>
            Tap the gear icon to connect Todoist or Google Calendar.
          </Text>
        </View>
      );
    }
    if (isLoading && !isRefreshing && queue.length === 0) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A9BAF" />
        </View>
      );
    }
    if (error === 'invalid_token' && queue.length === 0) {
      const tokenMissing = tokenFoundInStorage === false;
      return (
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={40} color="#8A8A8A" />
          <Text style={styles.emptyHeading}>
            {tokenMissing ? 'Todoist disconnected' : 'Todoist session error'}
          </Text>
          <Text style={styles.emptyHint}>
            {tokenMissing
              ? 'Your session was lost. Reconnect to continue.'
              : 'Todoist rejected your session. This may be temporary.'}
          </Text>
          {authErrorDetail && (
            <Text style={styles.errorDetail}>{authErrorDetail}</Text>
          )}
          {!tokenMissing && (
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchCards(todoistToken)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              if (!tokenMissing) setTodoistToken(null);
              router.push('/settings');
            }}
          >
            <Text style={styles.retryText}>Reconnect Todoist</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (error === 'network' && queue.length === 0) {
      return (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color="#8A8A8A" />
          <Text style={styles.emptyHeading}>Couldn't load tasks</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchCards(todoistToken)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (current) {
      return (
        <FlipCard
          key={current.id + '-' + laterSeq}
          card={current}
          onDone={() => markDone(current.id)}
          onLater={() => {
            if (queue.length === 1) setLaterSeq(s => s + 1);
            moveLater(current.id);
          }}
          onTomorrow={current.type === 'task' ? () => {
            rescheduleTomorrow(current.id);
            if (rescheduledTimerRef.current) clearTimeout(rescheduledTimerRef.current);
            setShowRescheduledToast(true);
            rescheduledTimerRef.current = setTimeout(() => setShowRescheduledToast(false), 2000);
          } : undefined}
          onOpen={current.sourceUrl ? () => Linking.openURL(current.sourceUrl!) : undefined}
        />
      );
    }
    return isRefreshing ? null : <EmptyState />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        {Platform.OS === 'web' ? (
          <a
            href="https://www.shirahaddad.com"
            title="https://www.shirahaddad.com"
            style={{ color: '#8A8A8A', fontSize: 12, fontFamily: 'Poppins, sans-serif', textDecoration: 'none', padding: '6px 0' }}
          >
            Home
          </a>
        ) : (
          <View style={styles.topBarSpacer} />
        )}
        <View style={styles.topBarRight}>
          {todoistToken && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddTask(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add-outline" size={24} color="#8A8A8A" />
            </TouchableOpacity>
          )}
          {Platform.OS === 'web' ? (
            <span title="Settings" style={{ display: 'contents' } as any}>
              <TouchableOpacity
                style={styles.gearButton}
                onPress={() => router.push('/settings')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="settings-outline" size={22} color="#8A8A8A" />
              </TouchableOpacity>
            </span>
          ) : (
            <TouchableOpacity
              style={styles.gearButton}
              onPress={() => router.push('/settings')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="settings-outline" size={22} color="#8A8A8A" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {((todoistToken || googleConnected) && queue.length > 0) && <ProgressBar />}
      {todoistDisconnected && queue.length > 0 && (
        <View style={styles.todoist_banner}>
          <Text style={styles.bannerText}>Todoist disconnected</Text>
          <TouchableOpacity
            onPress={() => { setTodoistToken(null); router.push('/settings'); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.bannerAction}>Reconnect →</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#4A9BAF"
            colors={['#4A9BAF']}
          />
        }
      >
        {renderBody()}
      </ScrollView>
      <View style={[styles.undoToast, !pendingUndo && styles.undoToastHidden]}>
        <Text style={styles.undoLabel}>Marked as done</Text>
        <TouchableOpacity onPress={cancelPendingUndo} disabled={!pendingUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.undoButton}>Undo</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.undoToast, !showRescheduledToast && styles.undoToastHidden]}>
        <Text style={styles.undoLabel}>Rescheduled to tomorrow</Text>
      </View>
      <AddTaskModal
        visible={showAddTask}
        onClose={() => setShowAddTask(false)}
        onCreated={() => {
          setShowAddTask(false);
          fetchCards(todoistToken);
        }}
        todoistToken={todoistToken}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  homeLink: {
    fontSize: 12,
    color: '#8A8A8A',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  topBarSpacer: {
    width: 40,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButton: {
    padding: 6,
  },
  gearButton: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F0EFEB',
    textAlign: 'center',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  emptyHint: {
    fontSize: 14,
    color: '#8A8A8A',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  errorDetail: {
    fontSize: 11,
    color: '#444',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  retryText: {
    fontSize: 15,
    color: '#4A9BAF',
    fontWeight: '500',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  todoist_banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  bannerText: {
    fontSize: 13,
    color: '#8A8A8A',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  bannerAction: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4A9BAF',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  undoToastHidden: {
    opacity: 0,
  },
  undoToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  undoLabel: {
    fontSize: 14,
    color: '#F0EFEB',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  undoButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A9BAF',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
});
