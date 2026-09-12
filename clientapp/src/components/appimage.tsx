import React, { memo, useEffect, useMemo } from 'react';
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
 * Prefetch
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Warm the cache for a page of images — but ONLY once the server has proven it
 * will send small ones.
 *
 * This guard is the important part. Prefetching is what makes a scroll feel
 * like the pictures were always there, and it is also the single worst thing
 * you can do to an app talking to a server that has not been updated yet: a
 * page of 50 products whose originals are three megabytes each is 150 MB of
 * eager downloads, competing with the very GraphQL queries that fill the list.
 * That looks exactly like the app being broken — empty grids, rows appearing
 * only as you scroll onto them — when nothing is broken at all, only starved.
 *
 * So before any prefetching happens, one HEAD request asks the server for a
 * 96px copy of a real image. A server with the resizer answers image/webp; one
 * without it answers with the original's own type. Only the first enables
 * prefetching, and the probe runs once per app launch. Nothing has to be
 * toggled by hand at deploy time — it turns itself on when the server is ready.
 */
type ResizerSupport = 'unknown' | 'checking' | 'yes' | 'no';
let resizerSupport: ResizerSupport = 'unknown';

/** Urls already handed to Image.prefetch this session — never asked twice. */
const warmed = new Set<string>();

/** Downloads in flight. Four keeps the pipe busy without crowding out queries. */
const PREFETCH_CONCURRENCY = 4;

const probeResizer = async (sampleStoredUrl: string): Promise<void> => {
  if (resizerSupport !== 'unknown') return;
  resizerSupport = 'checking';

  const probeUrl = resolveMediaUrl(sampleStoredUrl, 96);
  if (!probeUrl || !probeUrl.includes('?w=')) {
    // Not one of our uploads (a CDN, an external image) — nothing to probe.
    resizerSupport = 'no';
    return;
  }

  try {
    const res = await fetch(probeUrl, { method: 'HEAD' });
    const type = (res.headers.get('content-type') || '').toLowerCase();
    resizerSupport = res.ok && type.includes('webp') ? 'yes' : 'no';
  } catch {
    resizerSupport = 'no';
  }
};

export const preloadMedia = (
  urls: (string | null | undefined)[],
  width?: number,
): void => {
  const stored = urls.filter((u): u is string => Boolean(u));
  if (!stored.length) return;

  if (resizerSupport === 'unknown') {
    // Fire the probe and stop here. The next page of products (or the next
    // time this screen's list changes) will find the answer already settled.
    void probeResizer(stored[0]);
    return;
  }
  if (resizerSupport !== 'yes') return;

  const queue = Array.from(
    new Set(
      stored
        .map(u => resolveMediaUrl(u, width))
        .filter(u => Boolean(u) && !warmed.has(u)),
    ),
  );
  if (!queue.length) return;
  queue.forEach(u => warmed.add(u));

  let cursor = 0;
  const pump = (): void => {
    const next = queue[cursor++];
    if (next === undefined) return;
    Image.prefetch(next)
      .catch(() => {
        // A 404 or a dead host is not worth reporting: the card falls back to
        // its placeholder icon exactly as it would have anyway.
        warmed.delete(next);
      })
      .finally(pump);
  };

  for (let i = 0; i < Math.min(PREFETCH_CONCURRENCY, queue.length); i++) pump();
};

/**
 * Prefetch a list whenever it changes. `urls` may be rebuilt on every render —
 * the join below is what decides whether anything actually needs doing.
 */
export const usePreloadMedia = (
  urls: (string | null | undefined)[],
  width?: number,
): void => {
  const key = urls.filter(Boolean).join('|');
  useEffect(() => {
    if (!key) return;
    preloadMedia(key.split('|'), width);
  }, [key, width]);
};
