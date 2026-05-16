import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';

const EMOJIS = ['🎉', '🎊', '✨', '🌟', '🥳', '🎈', '🏆', '💫', '🌈', '🎯', '🦄', '🌸', '🎶', '🍀', '🎁'];

const SUGGESTIONS = [
  'Read a book',
  'Take a walk',
  'Text someone you love',
  'Play a videogame',
  'Take a nap',
  'How about crochet',
  'Go have fun',
  'Listen to music',
];

export function EmptyState({ onPeekTomorrow }: { onPeekTomorrow?: () => void }) {
  const [emoji] = useState(() => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  const [suggestion] = useState(() => SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)]);
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Animated.Text style={[styles.emoji, { transform: [{ scale }] }]}>{emoji}</Animated.Text>
      <Text style={styles.heading}>You're all done!</Text>
      <Text style={styles.suggestion}>{suggestion}</Text>
      {onPeekTomorrow && (
        <TouchableOpacity onPress={onPeekTomorrow} style={styles.tomorrowButton}>
          <Text style={styles.tomorrowText}>See what's tomorrow →</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  emoji: {
    fontSize: 64,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F0EFEB',
    textAlign: 'center',
  },
  suggestion: {
    fontSize: 18,
    color: '#8A8A8A',
    textAlign: 'center',
    marginTop: 4,
  },
  tomorrowButton: {
    marginTop: 24,
  },
  tomorrowText: {
    fontSize: 15,
    color: '#4A9BAF',
  },
});
