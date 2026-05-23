import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

export function CardDeck() {
  const router = useRouter();
  const { todoistToken, tokenFoundInStorage, setTodoistToken } = useAuthStore();
  const { accessToken: googleAccessToken, email: googleEmail } = useGoogleAuthStore();
  const googleConnected = !!(googleAccessToken || googleEmail);
  const { queue, isLoading, error, authErrorDetail, pendingUndo, markDone, commitPendingUndo, cancelPendingUndo, moveLater, fetchCards } = useDeckStore();

  useFocusEffect(
    useCallback(() => {
      if (todoistToken || googleConnected) fetchCards(todoistToken);
    }, [todoistToken, googleConnected])
  );

  const current = queue[0];
  const [laterSeq, setLaterSeq] = useState(0);
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
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A9BAF" />
        </View>
      );
    }
    if (error === 'invalid_token') {
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
    if (error === 'network') {
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
        />
      );
    }
    return isRefreshing ? null : <EmptyState />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.gearButton}
          onPress={() => router.push('/settings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={22} color="#8A8A8A" />
        </TouchableOpacity>
      </View>
      {((todoistToken || googleConnected) && !error && !isLoading) && <ProgressBar />}
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
      {pendingUndo && (
        <View style={styles.undoToast}>
          <Text style={styles.undoLabel}>Marked as done</Text>
          <TouchableOpacity onPress={cancelPendingUndo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.undoButton}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
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
  },
  emptyHint: {
    fontSize: 14,
    color: '#8A8A8A',
    textAlign: 'center',
    lineHeight: 20,
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
  },
  undoButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A9BAF',
  },
});
