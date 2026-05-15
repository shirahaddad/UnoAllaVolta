import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDeckStore } from '@/store/deckStore';
import { useAuthStore } from '@/store/authStore';
import { FlipCard } from './FlipCard';
import { ProgressBar } from './ProgressBar';
import { EmptyState } from './EmptyState';

export function CardDeck() {
  const router = useRouter();
  const { todoistToken } = useAuthStore();
  const { queue, isLoading, error, markDone, moveLater, fetchCards } = useDeckStore();

  useFocusEffect(
    useCallback(() => {
      if (todoistToken) fetchCards(todoistToken);
    }, [todoistToken])
  );

  const current = queue[0];

  function renderBody() {
    if (!todoistToken) {
      return (
        <View style={styles.centered}>
          <Ionicons name="link-outline" size={40} color="#2A2A2A" />
          <Text style={styles.emptyHeading}>No account connected</Text>
          <Text style={styles.emptyHint}>
            Tap the gear icon to connect your Todoist account.
          </Text>
        </View>
      );
    }
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4A9BAF" />
        </View>
      );
    }
    if (error === 'invalid_token') {
      return (
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={40} color="#8A8A8A" />
          <Text style={styles.emptyHeading}>Token invalid</Text>
          <Text style={styles.emptyHint}>Go to Settings to reconnect your Todoist account.</Text>
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
            onPress={() => fetchCards(todoistToken!)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (current) {
      return (
        <FlipCard
          key={current.id}
          card={current}
          onDone={() => markDone(current.id)}
          onLater={() => moveLater(current.id)}
        />
      );
    }
    return <EmptyState />;
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
      {(todoistToken && !error) && <ProgressBar />}
      {renderBody()}
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
});
