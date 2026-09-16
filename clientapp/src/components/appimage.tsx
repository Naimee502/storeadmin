import React, { memo, useMemo } from 'react';
import { ImageResizeMode, StyleProp, ImageStyle } from 'react-native';
import FastImage, { ResizeMode as FastImageResizeMode } from 'react-native-fast-image';
import { resolveMediaUrl } from '../config';

/**
 * Every remote image in the app goes through here.
 *
 * Three things it does that a bare image tag does not:
 *
 * 1. It asks for the size it is actually going to draw. The server keeps the
 *    original upload — a phone photo of several megabytes — and renders a
 *    small WebP copy on request. A product card asking for `IMG.card` gets
 *    about 25 KB instead of 3 MB.
 *
 *    That resize only happens when /uploads reaches the server. It currently
 *    does not: nginx answers those URLs itself and drops the "?w=" along with
 *    the caching headers, so every picture is still the full-size original and
 *    is re-requested on every launch. See server/deploy/nginx-uploads.conf —
 *    until that is deployed, no image library can make these pictures small.
 *
 * 2. It percent-encodes the path. Uploads keep the name they were uploaded
 *    under, and most of this store's carry a space; a literal space makes an
 *    invalid URL, which iOS refuses outright.
 *
 * 3. It keeps the `source` object identity stable. Building it inline makes a
 *    new object on every render, and these screens re-render constantly.
 *
 * What it deliberately does NOT do is hold state of its own. An earlier version
 * faded each picture in, which meant a timer and a setState inside every cell;
 * inside a recycled FlashList that is a re-render arriving in the middle of the
 * list's own measuring pass, and it showed up as blank and misplaced cards.
 *
 * ── On react-native-fast-image ──────────────────────────────────────────────
 * This is built on it by request. It is worth knowing what it is being asked
 * to do, and what it cannot do.
 *
 * It caches with Glide on Android and SDWebImage on iOS, both of which keep
 * their own disk cache and ignore HTTP cache headers — which is why it is
 * usually reached for. On Android that is close to what React Native's own
 * <Image> already gives through Fresco, so the gain there is small; on iOS,
 * where NSURLCache does follow the headers the server is not currently
 * sending, it is real. What neither library can do is make the first download
 * smaller: that is the "?w=" the server never sees.
 *
 * Compatibility is the open question. Version 8.6.3 is from 2023, it declares
 * peer dependencies of React 17/18 against this app's React 19, and its Android
 * view is a SimpleViewManager — a Paper component — while this app builds with
 * newArchEnabled=true on React Native 0.84, where the interop that used to
 * wrap such components is gone. If the build fails or the images render blank,
 * that is why, and it is not something a change in this file can work around.
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

/**
 * React Native's resizeMode is a string; FastImage wants one of its own
 * constants. "repeat" has no equivalent and falls back to cover.
 */
const RESIZE: Record<string, FastImageResizeMode> = {
  cover: FastImage.resizeMode.cover,
  contain: FastImage.resizeMode.contain,
  stretch: FastImage.resizeMode.stretch,
  center: FastImage.resizeMode.center,
  repeat: FastImage.resizeMode.cover,
};

function AppImageBase({
  uri,
  width,
  style,
  resizeMode = 'cover',
  onLoadEnd,
  onAspectRatio,
}: AppImageProps) {
  const resolved = useMemo(() => resolveMediaUrl(uri, width), [uri, width]);
  const source = useMemo(
    () => ({
      uri: resolved,
      // Every URL here is content-addressed in practice — upload names carry
      // Date.now() and the width is in the query — so the bytes behind one
      // never change. `immutable` tells Glide/SDWebImage exactly that, and
      // stops them revalidating a picture they already hold. It is also what
      // lets this work while the server sends no cache headers of its own.
      cache: FastImage.cacheControl.immutable,
      priority: FastImage.priority.normal,
    }),
    [resolved],
  );

  if (!resolved) return null;

  return (
    <FastImage
      source={source}
      style={style as any}
      resizeMode={RESIZE[resizeMode] ?? FastImage.resizeMode.cover}
      onLoad={(e: any) => {
        // FastImage reports the decoded size directly on nativeEvent; React
        // Native's own Image nests it under nativeEvent.source.
        const { width: w, height: h } = e?.nativeEvent ?? {};
        if (onAspectRatio && w && h) onAspectRatio(w / h);
      }}
      onLoadEnd={() => onLoadEnd?.()}
      onError={() => onLoadEnd?.()}
    />
  );
}

export const AppImage = memo(AppImageBase);

/* ────────────────────────────────────────────────────────────────────────────
 * A note on prefetching, since it will be tempting to add it back
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * There is deliberately no prefetching here, and FastImage.preload is the same
 * trap under a different name.
 *
 * It was tried, and it broke the app twice in ways that looked nothing like an
 * image problem. Android pulls every image — preloaded or on screen — through
 * one small pool of network connections, and a visible card gets no priority
 * over a warming one. Warming a whole page of products therefore puts the four
 * cards the customer is looking at behind forty-six they cannot see. Do it on
 * two screens and change category a few times and there are hundreds of
 * downloads queued against the same connection the GraphQL queries need, so
 * the product list itself stops arriving. The screen goes blank and nothing in
 * the symptom points back at the cause.
 *
 * FlashList already builds about a screen beyond the scroll, so a card's
 * picture starts downloading well before it is looked at. The one thing
 * prefetching genuinely bought — never paying for the very first resize —
 * belongs on the server, where `npm run warm-images` renders every upload once,
 * offline, at no cost to anybody's phone.
 */
