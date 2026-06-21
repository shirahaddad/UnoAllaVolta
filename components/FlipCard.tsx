import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Linking,
  Platform,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/store/deckStore';

const CARD_WIDTH = Math.min(Dimensions.get('window').width, 430) - 48;

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
  onTomorrow?: () => void;
  onOpen?: () => void;
}

export function FlipCard({ card, onDone, onLater, onTomorrow, onOpen }: FlipCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isPanning = useRef(false);
  const currentDx = useRef(0);
  const startX = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const onDoneRef = useRef(onDone);
  const onLaterRef = useRef(onLater);
  onDoneRef.current = onDone;
  onLaterRef.current = onLater;

  function handleRelease(dx: number) {
    isPanning.current = false;
    setIsDragging(false);
    if (dx > SWIPE_THRESHOLD) {
      Animated.timing(translateX, { toValue: 500, duration: 250, useNativeDriver: true })
        .start(() => onDoneRef.current());
    } else if (dx < -SWIPE_THRESHOLD) {
      Animated.timing(translateX, { toValue: -500, duration: 250, useNativeDriver: true })
        .start(() => onLaterRef.current());
    } else {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    }
  }

  // Last-resort fallback: catches mouseup that fires outside the card but still in the window
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onWindowMouseUp = () => {
      if (isPanning.current) handleRelease(currentDx.current);
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, []);

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

  const activePointerId = useRef(-1);

  // Web: pointer capture ensures pointerup fires even when mouse leaves the browser window.
  // Capture is deferred to the first move >5px so that clicks on child elements (links)
  // still receive their pointerup and generate a click event normally.
  const webPointerHandlers = Platform.OS === 'web' ? {
    onPointerDown: (e: any) => {
      activePointerId.current = e.pointerId;
      startX.current = e.clientX;
      currentDx.current = 0;
    },
    onPointerMove: (e: any) => {
      if (e.pointerId !== activePointerId.current) return;
      const dx = e.clientX - startX.current;
      if (!isPanning.current && Math.abs(dx) > 5) {
        e.currentTarget.setPointerCapture(e.pointerId);
        isPanning.current = true;
        setIsDragging(true);
      }
      if (!isPanning.current) return;
      currentDx.current = dx;
      translateX.setValue(dx);
    },
    onPointerUp: (e: any) => {
      if (e.pointerId !== activePointerId.current) return;
      activePointerId.current = -1;
      if (isPanning.current) handleRelease(currentDx.current);
    },
    onPointerCancel: (e: any) => {
      if (e.pointerId !== activePointerId.current) return;
      activePointerId.current = -1;
      if (isPanning.current) handleRelease(0);
    },
  } : {};

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx }) => Math.abs(dx) > 5,
      onPanResponderMove: (_, { dx }) => {
        isPanning.current = true;
        currentDx.current = dx;
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, { dx }) => {
        handleRelease(dx);
      },
    })
  ).current;

  const isCalendar = card.type === 'calendar';

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.card,
          { transform: [{ translateX }, { rotate }] },
          Platform.OS === 'web' && ({ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' } as any),
        ]}
        {...(Platform.OS === 'web' ? webPointerHandlers : panResponder.panHandlers)}
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
        {onOpen && (
          <TouchableOpacity
            style={styles.openButton}
            onPress={onOpen}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="open-outline" size={16} color="#4A4A4A" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{card.title}</Text>
        <Text style={styles.subtitle}>{card.subtitle}</Text>
        {card.description ? <DescriptionText text={card.description} /> : null}
      </Animated.View>

      {onTomorrow && (
        <TouchableOpacity style={styles.tomorrowButton} onPress={onTomorrow}>
          <Text style={styles.tomorrowButtonText}>Tomorrow</Text>
        </TouchableOpacity>
      )}
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
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
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
    fontFamily: Platform.select({ web: "'DM Serif Display', serif" }),
  },
  subtitle: {
    fontSize: 15,
    color: '#8A8A8A',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  description: {
    fontSize: 14,
    color: '#6A6A6A',
    lineHeight: 20,
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  link: {
    color: '#4A9BAF',
    textDecorationLine: 'underline',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
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
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
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
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
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
  openButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  tomorrowButton: {
    width: CARD_WIDTH,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
  },
  tomorrowButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6A6A6A',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  laterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8A8A',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F0F',
    fontFamily: Platform.select({ web: 'Poppins, sans-serif' }),
  },
});
