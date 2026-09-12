import React, { memo, useMemo } from 'react';
import {
  Image, ImageResizeMode, StyleProp, ImageStyle,
  NativeSyntheticEvent, ImageLoadEventData,
} from 'react-native';
import { resolveMediaUrl } from '../config';

/**
 * Every remote image in the app goes through here.
 *
 * Two things it does that a bare <Image source={{ uri }} /> does not:
 *
 * 1. It asks for the size it is actually going to draw. The server keeps the
 *    original upload — a phone photo of several megabytes — and renders a
 *    small WebP copy on request. A product card asking for `IMG.card` gets
 *    about 25 KB instead of 3 MB, which is the whole difference between a grid
 *    that paints instantly and one that sits on grey boxes until you navigate
 *    away and come back.
 *
 * 2. It keeps the `source` object identity stable. `source={{ uri }}` builds a
 *    new object on every render, and these screens re-render constantly — the
 *    cart changes, a price resolves, a settings query lands. Memoising it means
 *    the native image view is never handed "new" work for a picture it is
 *    already showing.
 *
 * What it deliberately does NOT do is hold state of its own. An earlier version
 * faded each picture in, which meant a timer and a setState inside every cell;
 * inside a recycled FlashList that is a re-render arriving in the middle of the
 * list's own measuring pass, and it showed up as blank and misplaced cards.
 * A plain image with a stable source is both faster and correct.
 *
 * It is built on React Native's own <Image>. react-native-fast-image is still
 * in package.json but has no Fabric support, and this app runs on the new
 * architecture; the caching it was wanted for is what the server's immutable
 * Cache-Control headers provide anyway.
 */

export interface AppImageProps {
  /** The url as stored (absolute or relative); resolved and sized here. */
  uri?: string | null;
  /** Target width in px — use a value from `IMG`. Omit to fetch the original. */
  width?: number;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Kept for call sites that used to ask for no fade; nothing fades now. */
  instant?: boolean;
  onLoadEnd?: () => void;
  /**
   * The image's real width/height ratio, reported once it is decoded — for
   * layouts that size their box to the photo instead of cropping it.
   */
  onAspectRatio?: (ratio: number) => void;
}

function AppImageBase({
  uri,
  width,
  style,
  resizeMode = 'cover',
  onLoadEnd,
  onAspectRatio,
}: AppImageProps) {
  const resolved = useMemo(() => resolveMediaUrl(uri, width), [uri, width]);
  const source = useMemo(() => ({ uri: resolved }), [resolved]);

  if (!resolved) return null;

  return (
    <Image
      source={source}
      style={style}
      resizeMode={resizeMode}
      onLoad={(e: NativeSyntheticEvent<ImageLoadEventData>) => {
        const { width: w, height: h } = (e?.nativeEvent?.source ?? {}) as any;
        if (onAspectRatio && w && h) onAspectRatio(w / h);
        onLoadEnd?.();
      }}
      onError={() => onLoadEnd?.()}
    />
  );
}

export const AppImage = memo(AppImageBase);

/* ────────────────────────────────────────────────────────────────────────────
 * A note on prefetching, since it will be tempting to add it back
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * There is deliberately no prefetching here.
 *
 * It was tried, and it broke the app twice in ways that looked nothing like an
 * image problem. Android pulls every image — prefetched or on screen — through
 * one small pool of network connections, and a visible card gets no priority
 * over a warming one. Warming a whole page of products therefore puts the four
 * cards the customer is looking at behind forty-six they cannot see. Do it on
 * two screens and change category a few times and there are hundreds of
 * downloads queued against the same connection the GraphQL queries need, so
 * the product list itself stops arriving. The screen goes blank and nothing in
 * the symptom points back at the cause.
 *
 * It is not needed either. The server now answers with a ~25 KB WebP instead of
 * a three megabyte original, and FlashList already builds about a screen beyond
 * the scroll, so a card's picture starts downloading well before it is looked
 * at. The one thing prefetching genuinely bought — never paying for the very
 * first resize — belongs on the server, where `npm run warm-images` renders
 * every upload once, offline, at no cost to anybody's phone.
 */
