import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDeckStore } from '@/store/deckStore';

export function ProgressBar() {
  const { queue, doneCount, laterCount, totalCount, browseIndex } = useDeckStore();

  const current = laterCount + browseIndex + 1;
  const total = totalCount - doneCount;
  const highlightIndex = laterCount + browseIndex;

  if (queue.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>All done</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{current} of {total}</Text>
      <View style={styles.track}>
        {Array.from({ length: total > 0 ? total : 1 }).map((_, i) => (
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
