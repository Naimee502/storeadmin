import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal, Dimensions, StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FONTS, useTheme, resolveMediaUrl } from '../../../../config';

const { width: SCREEN_W } = Dimensions.get('window');
// EDGE matches the hero banner's own horizontal inset, so the grid's outer
// edges sit on the same two lines the banner above it does. GAP is the smaller
// space between tiles — a grid reads as a grid when the gutters are tighter
// than the margins.
const EDGE = 18;
const GAP = 10;
const COLUMNS = 3;
const TILE_W = (SCREEN_W - EDGE * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

export type Tile = {
  id: string;
  label: string;
  image?: string | null;
};

/**
 * The three-across picture grid the catalogue browses with — categories first,
 * then sub-categories inside one.
 *
 * A tile is a picture with its name on a brand-coloured caption underneath,
 * which is the shape the businesses using this mode already had their staff and
 * customers trained on. Sub-categories have no image in this system (only
 * categories and products do), so their tiles show the caption over a plain
 * panel rather than a broken frame.
 */
export const TileGrid: React.FC<{
  tiles: Tile[];
  onPress: (tile: Tile) => void;
  emptyLabel?: string;
}> = ({ tiles, onPress, emptyLabel = 'Nothing here yet.' }) => {
  const { colors } = useTheme();

  if (!tiles.length) {
    return (
      <View style={styles.empty}>
        <Icon name="package-variant-closed" size={40} color={colors.placeholder} />
        <Text style={[styles.emptyText, { color: colors.subText }]}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {tiles.map((t) => {
        const uri = resolveMediaUrl(t.image);
        return (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.tile,
              { width: TILE_W, backgroundColor: colors.brand, borderColor: colors.border },
            ]}
            activeOpacity={0.8}
            onPress={() => onPress(t)}
          >
            <View style={[styles.tileImgWrap, { backgroundColor: colors.white, borderBottomColor: colors.border }]}>
              {uri ? (
                <Image source={{ uri }} style={styles.tileImg} resizeMode="contain" />
              ) : (
                <Icon name="shape-outline" size={30} color={colors.placeholder} />
              )}
            </View>
            <Text style={styles.tileLabel} numberOfLines={3}>
              {t.label.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

/**
 * Full-screen look at one product photo, opened from the small image button on
 * an order-sheet line. The line itself stays a line: the customer is typing
 * quantities down a list and only occasionally needs to check what a part
 * actually looks like.
 */
export const ImageViewer: React.FC<{
  uri: string | null;
  onClose: () => void;
}> = ({ uri, onClose }) => {
  const { colors } = useTheme();
  return (
    <Modal visible={!!uri} transparent={false} animationType="fade" onRequestClose={onClose}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.brand} />
      <View style={[styles.viewerRoot, { backgroundColor: colors.white }]}>
        <TouchableOpacity
          style={[styles.viewerClose, { backgroundColor: colors.brand }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Icon name="close" size={22} color={colors.onBrand} />
        </TouchableOpacity>
        {uri ? (
          <Image source={{ uri: resolveMediaUrl(uri) }} style={styles.viewerImg} resizeMode="contain" />
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: GAP, paddingHorizontal: EDGE, paddingTop: 12,
  },
  // The same hairline card edge the product grid uses, so a category tile and
  // a product card read as the same kind of object.
  tile: { borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  tileImgWrap: {
    height: TILE_W * 0.82,
    alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1,
  },
  tileImg: { width: '100%', height: '100%' },
  tileLabel: {
    color: '#fff', fontSize: 12, fontFamily: FONTS.semiBold,
    textAlign: 'center', paddingHorizontal: 6, paddingVertical: 10, lineHeight: 16,
  },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular },

  viewerRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '70%' },
  viewerClose: {
    position: 'absolute', top: 40, right: 18, zIndex: 2,
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
});
