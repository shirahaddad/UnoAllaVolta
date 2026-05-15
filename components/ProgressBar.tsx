import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDeckStore } from '@/store/deckStore';

export function ProgressBar() {
  const { queue } = useDeckStore();

  const Y = queue.length;
  const X = queue[0]?.order ?? 1;
  const highlightIndex = Math.min(X, Y) - 1;

  if (Y === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>All done</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{X} of {Y}</Text>
      <View style={styles.track}>
        {Array.from({ length: Y }).map((_, i) => (
          <View
            key={i}
            style={[styles.segment, i === highlightIndex && styles.segmentActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
  },
  label: {
    fontSize: 13,
    color: '#8A8A8A',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  track: {
    height: 2,
    flexDirection: 'row',
    gap: 3,
  },
  segment: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 1,
  },
  segmentActive: {
    backgroundColor: '#4A9BAF',
  },
});
