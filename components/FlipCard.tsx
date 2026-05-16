import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card } from '@/store/deckStore';

const CARD_WIDTH = Dimensions.get('window').width - 48;

const URL_REGEX = /https?:\/\/\S+/g;

function DescriptionText({ text }: { text: string }) {
  const preview = text.length > 300 ? text.slice(0, 300) + '…' : text;
  const parts: { str: string; isUrl: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((m = URL_REGEX.exec(preview)) !== null) {
    if (m.index > last) parts.push({ str: preview.slice(last, m.index), isUrl: false });
    parts.push({ str: m[0], isUrl: true });
    last = m.index + m[0].length;
  }
  if (last < preview.length) parts.push({ str: preview.slice(last), isUrl: false });

  return (
    <Text style={styles.description} numberOfLines={4}>
      {parts.map((p, i) =>
        p.isUrl
          ? <Text key={i} style={styles.link} onPress={() => Linking.openURL(p.str)}>{p.str}</Text>
          : <Text key={i}>{p.str}</Text>
      )}
    </Text>
  );
}

const SWIPE_THRESHOLD = 100;

interface FlipCardProps {
  card: Card;
  onDone: () => void;
  onLater: () => void;
}

export function FlipCard({ card, onDone, onLater }: FlipCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rotate = translateX.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-8deg', '0deg', '8deg'],
  });
  const doneOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const laterOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx }) => Math.abs(dx) > 5,
      onPanResponderMove: (_, { dx }) => {
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, { dx }) => {
        if (dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: 500,
            duration: 250,
            useNativeDriver: true,
          }).start(onDone);
        } else if (dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -500,
            duration: 250,
            useNativeDriver: true,
          }).start(onLater);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const isCalendar = card.type === 'calendar';

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[styles.card, { transform: [{ translateX }, { rotate }] }]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[styles.doneLabel, { opacity: doneOpacity }]}>
          <Text style={styles.doneLabelText}>DONE</Text>
        </Animated.View>
        <Animated.View style={[styles.laterLabel, { opacity: laterOpacity }]}>
          <Text style={styles.laterLabelText}>LATER</Text>
        </Animated.View>

        <View style={[styles.chip, isCalendar ? styles.chipCalendar : styles.chipTask]}>
          <Text style={[styles.chipText, isCalendar ? styles.chipTextCalendar : styles.chipTextTask]}>
            {card.type}
          </Text>
        </View>
        <Text style={styles.title}>{card.title}</Text>
        <Text style={styles.subtitle}>{card.subtitle}</Text>
        {card.description ? <DescriptionText text={card.description} /> : null}
      </Animated.View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, styles.laterButton]} onPress={onLater}>
          <Text style={styles.laterButtonText}>Later</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.doneButton]} onPress={onDone}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  card: {
    width: CARD_WIDTH,
    minHeight: 220,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 28,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipCalendar: {
    backgroundColor: 'transparent',
    borderColor: '#4A9BAF',
  },
  chipTask: {
    backgroundColor: 'transparent',
    borderColor: '#5A7A6A',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chipTextCalendar: {
    color: '#4A9BAF',
  },
  chipTextTask: {
    color: '#5A9A7A',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F0EFEB',
  },
  subtitle: {
    fontSize: 15,
    color: '#8A8A8A',
  },
  description: {
    fontSize: 14,
    color: '#6A6A6A',
    lineHeight: 20,
  },
  link: {
    color: '#4A9BAF',
    textDecorationLine: 'underline',
  },
  doneLabel: {
    position: 'absolute',
    top: 20,
    right: 20,
    borderWidth: 2,
    borderColor: '#4A9BAF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '15deg' }],
  },
  doneLabelText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4A9BAF',
    letterSpacing: 1,
  },
  laterLabel: {
    position: 'absolute',
    top: 20,
    left: 20,
    borderWidth: 2,
    borderColor: '#8A8A8A',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-15deg' }],
  },
  laterLabelText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#8A8A8A',
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 120,
    alignItems: 'center',
  },
  laterButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  doneButton: {
    backgroundColor: '#4A9BAF',
  },
  laterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8A8A',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F0F',
  },
});
