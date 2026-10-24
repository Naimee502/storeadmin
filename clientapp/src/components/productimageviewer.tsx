import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList,
  ActivityIndicator, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppImage } from './appimage';
import { FONTS, IMG, useTheme } from '../config';

/** Every photo of a product: imageurls[] when the admin uploaded a gallery, else the single imageurl. */
export const productImages = (p: any): string[] => {
  const list: string[] = (p?.imageurls ?? []).filter(Boolean);
  if (list.length) return list;
  return p?.imageurl ? [p.imageurl] : [];
};

/**
 * Compact product photo viewer — a centred card over a dimmed screen, not a
 * full-screen takeover. Swipe (or tap a thumbnail) through every photo.
 *
 * Speed: every picture is asked for at IMG.product, the same width the product
 * cards and the party app use. Width is part of the URL and the URL is the
 * cache key, so the photo already on the card opens instantly, and the others
 * are shared with the party login's cache. (IMG.full was a separate, multi-MB
 * download — that is what left the old viewer blank.)
 */
export const ProductImageViewer: React.FC<{
  images: string[];
  title?: string;
  visible: boolean;
  onClose: () => void;
}> = ({ images, title, visible, onClose }) => {
  const { colors } = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const cardW = Math.min(screenW - 32, 420);
  const imgSize = Math.min(cardW - 24, screenH * 0.5);
  const [idx, setIdx] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  // Always open on the first (main) photo.
  useEffect(() => { if (visible) setIdx(0); }, [visible]);

  const goTo = (i: number) => {
    setIdx(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / imgSize);
    if (i !== idx && i >= 0 && i < images.length) setIdx(i);
  };

  const many = images.length > 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Tap outside the card to close. */}
      <Pressable style={[styles.backdrop, { backgroundColor: colors.modalOverlay }]} onPress={onClose}>
        <Pressable style={[styles.card, { width: cardW, backgroundColor: colors.raisedSurface }]} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title || 'Product photos'}</Text>
            <Pressable
              style={[styles.closeBtn, { backgroundColor: colors.brandSoft }]}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close" size={18} color={colors.brand} />
            </Pressable>
          </View>

          <View style={[styles.stage, { width: imgSize, height: imgSize, backgroundColor: colors.softSurface }]}>
            <FlatList
              ref={listRef}
              data={images}
              keyExtractor={(u, i) => `${i}-${u}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              getItemLayout={(_, i) => ({ length: imgSize, offset: imgSize * i, index: i })}
              // Only the photo on screen and its neighbours are fetched — no
              // queue of downloads competing with the product list.
              initialNumToRender={2}
              windowSize={3}
              renderItem={({ item }) => (
                <View style={{ width: imgSize, height: imgSize }}>
                  <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.brand} />
                  <AppImage
                    uri={item}
                    width={IMG.product}
                    style={StyleSheet.absoluteFill}
                    resizeMode="contain"
                    fallback={
                      <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.softSurface }]}>
                        <Icon name="image-off-outline" size={36} color={colors.subText} />
                      </View>
                    }
                  />
                </View>
              )}
            />
            {many && (
              <View style={[styles.counter, { backgroundColor: colors.dimOverlay }]}>
                <Text style={styles.counterText}>{idx + 1} / {images.length}</Text>
              </View>
            )}
          </View>

          {many && (
            <FlatList
              data={images}
              keyExtractor={(u, i) => `t${i}-${u}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbRow}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => goTo(index)}
                  style={[
                    styles.thumb,
                    { borderColor: index === idx ? colors.brand : colors.border, backgroundColor: colors.softSurface },
                  ]}
                >
                  <AppImage
                    uri={item}
                    width={IMG.product}
                    style={styles.thumbImg}
                    resizeMode="cover"
                    fallback={<Icon name="image-off-outline" size={16} color={colors.subText} />}
                  />
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    borderRadius: 20, padding: 12, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 10, paddingLeft: 4 },
  title: { flex: 1, fontSize: 15, fontFamily: FONTS.semiBold, marginRight: 8 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  stage: { borderRadius: 14, overflow: 'hidden' },
  center: { justifyContent: 'center', alignItems: 'center' },
  counter: { position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  counterText: { color: '#fff', fontSize: 11, fontFamily: FONTS.semiBold },
  thumbRow: { gap: 8, paddingTop: 10, paddingHorizontal: 2 },
  thumb: { width: 52, height: 52, borderRadius: 10, borderWidth: 2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  thumbImg: { width: '100%', height: '100%' },
});
