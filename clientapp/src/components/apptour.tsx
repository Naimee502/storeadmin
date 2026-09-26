import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn } from 'react-native-reanimated';
import { FONTS, useTheme } from '../config';

/**
 * First-time guide ("coach marks"): dims the screen, cuts a hole around one
 * control at a time and explains it in a card with Skip · dots · Next/Finish.
 *
 * Any view can be a step. Give it a ref from `tourRef('<id>')` and list that id
 * in <AppTour steps>. The registry is module-level on purpose: the targets live
 * in different trees (the header, the screen, the tab bar) and none of them
 * need to know a tour exists.
 *
 * Shown once per `storageKey` — the key carries the party's id, so each party
 * sees it on their first login on this device and never again.
 */

/* ── Target registry ─────────────────────────────────────────────── */
const targets = new Map<string, View | null>();
const refCache = new Map<string, (v: View | null) => void>();

/** Stable callback ref that registers a view as the tour target `id`. */
export const tourRef = (id: string) => {
  let fn = refCache.get(id);
  if (!fn) {
    fn = (v: View | null) => { targets.set(id, v); };
    refCache.set(id, fn);
  }
  return fn;
};

type Rect = { x: number; y: number; w: number; h: number };

const measure = (id: string): Promise<Rect | null> =>
  new Promise((resolve) => {
    const v = targets.get(id);
    if (!v || typeof (v as any).measure !== 'function') return resolve(null);
    // measure()'s pageX/pageY are from the top of the screen — the same origin
    // the full-screen (statusBarTranslucent) Modal draws from. measureInWindow
    // on Android is relative to the area BELOW the status bar, which put every
    // highlight one status-bar too high.
    (v as any).measure((_x: number, _y: number, w: number, h: number, px: number, py: number) => {
      resolve(w > 0 && h > 0 ? { x: px, y: py, w, h } : null);
    });
  });

/** Forget a tour so it shows again (e.g. a "Show app guide" menu item). */
export const resetTour = (storageKey: string) => AsyncStorage.removeItem(storageKey).catch(() => {});

/* ── Tour ────────────────────────────────────────────────────────── */
export interface TourStep { target: string; title: string; text: string }

interface Props {
  steps: TourStep[];
  /** One key per audience — include the user's id so it is once per user. */
  storageKey: string;
  /** Hold off until the screen has what it needs (logged in, data drawn). */
  enabled?: boolean;
}

const PAD = 6;       // space between the control and the highlight ring
const ARROW = 10;
const CARD_MARGIN = 16;

export const AppTour: React.FC<Props> = ({ steps, storageKey, enabled = true }) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [live, setLive] = useState<TourStep[]>([]);
  const started = useRef(false);

  // Decide once whether this user has seen it, then measure which steps are
  // actually on screen — a control that isn't rendered is skipped, not pointed
  // at thin air.
  useEffect(() => {
    if (!enabled || !storageKey || started.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (await AsyncStorage.getItem(storageKey)) return;
      } catch {
        return; // can't tell whether it was seen — never risk showing it twice
      }
      const present: TourStep[] = [];
      for (const s of steps) if (await measure(s.target)) present.push(s);
      if (cancelled || !present.length) return;
      started.current = true;
      // Marked seen the moment it appears, not only on Finish/Skip — so killing
      // the app mid-tour, or the phone dying, doesn't bring it back next time.
      AsyncStorage.setItem(storageKey, '1').catch(() => {});
      setLive(present);
      setIndex(0);
      setRect(await measure(present[0].target));
      setVisible(true);
    }, 900); // let the header, banner and tab bar finish laying out
    return () => { cancelled = true; clearTimeout(t); };
  }, [enabled, storageKey, steps]);

  const finish = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(storageKey, '1').catch(() => {});
  }, [storageKey]);

  const go = useCallback(async (next: number) => {
    if (next >= live.length) return finish();
    const r = await measure(live[next].target);
    setIndex(next);
    setRect(r);
  }, [live, finish]);

  if (!visible || !live[index]) return null;

  const { width: W, height: H } = Dimensions.get('screen');
  const step = live[index];
  const last = index === live.length - 1;

  const ready = !!rect;
  const hole = ready
    ? { x: rect!.x - PAD, y: rect!.y - PAD, w: rect!.w + PAD * 2, h: rect!.h + PAD * 2 }
    : { x: 0, y: 0, w: 0, h: 0 };
  const below = hole.y + hole.h / 2 < H / 2;
  const cardTop = below ? hole.y + hole.h + ARROW + 4 : undefined;
  const cardBottom = below ? undefined : H - hole.y + ARROW + 4;
  const arrowLeft = Math.min(Math.max(hole.x + hole.w / 2 - ARROW, CARD_MARGIN + 14), W - CARD_MARGIN - 14 - ARROW * 2);
  const dim = 'rgba(0,0,0,0.62)';

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={finish}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={StyleSheet.absoluteFill}>
        {!ready ? <View style={[StyleSheet.absoluteFill, { backgroundColor: dim }]} /> : (<>
        {/* Four panels around the hole — the control itself stays bright. */}
        <View style={[styles.dim, { backgroundColor: dim, top: 0, left: 0, right: 0, height: Math.max(0, hole.y) }]} />
        <View style={[styles.dim, { backgroundColor: dim, top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.dim, { backgroundColor: dim, top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h }]} />
        <View style={[styles.dim, { backgroundColor: dim, top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
        <Animated.View
          key={`ring-${index}`}
          entering={FadeIn.duration(250)}
          style={[styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h }]}
        />

        {/* Arrow */}
        <View
          style={[
            styles.arrow,
            { left: arrowLeft, borderColor: 'transparent' },
            below
              ? { top: hole.y + hole.h + 4, borderBottomColor: colors.raisedSurface, borderTopWidth: 0 }
              : { top: hole.y - ARROW - 4, borderTopColor: colors.raisedSurface, borderBottomWidth: 0 },
          ]}
        />

        {/* Card */}
        <Animated.View
          key={`card-${index}`}
          entering={FadeIn.duration(250)}
          style={[
            styles.card,
            { backgroundColor: colors.raisedSurface, top: cardTop, bottom: cardBottom },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{step.title}</Text>
          <Text style={[styles.text, { color: colors.subText }]}>{step.text}</Text>
          <View style={styles.footer}>
            {last ? (
              <Text style={[styles.skip, { opacity: 0 }]}>Skip</Text>
            ) : (
              <TouchableOpacity onPress={finish} hitSlop={10}>
                <Text style={[styles.skip, { color: colors.subText }]}>Skip</Text>
              </TouchableOpacity>
            )}
            <View style={styles.dots}>
              {live.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i === index ? colors.brand : colors.border },
                    i === index && styles.dotActive,
                  ]}
                />
              ))}
            </View>
            <TouchableOpacity onPress={() => go(index + 1)} hitSlop={10}>
              <Text style={[styles.next, { color: colors.brand }]}>{last ? 'Finish' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        </>)}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  dim: { position: 'absolute' },
  ring: { position: 'absolute', borderWidth: 2, borderRadius: 6, borderColor: 'rgba(255,255,255,0.95)' },
  arrow: {
    position: 'absolute', width: 0, height: 0,
    borderLeftWidth: ARROW, borderRightWidth: ARROW, borderTopWidth: ARROW, borderBottomWidth: ARROW,
  },
  card: {
    position: 'absolute', left: CARD_MARGIN, right: CARD_MARGIN,
    borderRadius: 18, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10,
  },
  title: { fontSize: 18, fontFamily: FONTS.bold, marginBottom: 6 },
  text: { fontSize: 15, lineHeight: 22, fontFamily: FONTS.regular },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  skip: { fontSize: 15, fontFamily: FONTS.regular },
  next: { fontSize: 16, fontFamily: FONTS.bold },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotActive: { width: 22 },
});
