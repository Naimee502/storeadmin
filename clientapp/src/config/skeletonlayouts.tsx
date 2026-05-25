import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Skeleton from '../components/skeleton';
import { useTheme } from './theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - 18 * 2 - 12) / 2;

// ── Generic row skeleton ────────────────────────────────────────────────────

const Row = ({ children, style }: any) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>
);

// ── Existing: Product list (2-col grid) ────────────────────────────────────

export const ProductListSkeleton = () => {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {[1, 2, 3, 4].map((item) => (
        <View key={item} style={[styles.productCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Skeleton width="100%" height={100} borderRadius={12} />
          <Skeleton width="70%" height={13} style={{ marginTop: 10 }} />
          <Skeleton width="45%" height={11} style={{ marginTop: 6 }} />
          <Row style={{ marginTop: 10, justifyContent: 'space-between' }}>
            <Skeleton width={50} height={16} borderRadius={4} />
            <Skeleton width={32} height={32} borderRadius={10} />
          </Row>
        </View>
      ))}
    </View>
  );
};

// ── New: Product grid (used in Catalog loading) ────────────────────────────

export const ProductGridSkeleton = () => {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.productCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Skeleton width="100%" height={90} borderRadius={12} />
          <Skeleton width="75%" height={13} style={{ marginTop: 10 }} borderRadius={6} />
          <Skeleton width="45%" height={11} style={{ marginTop: 5 }} borderRadius={6} />
          <Skeleton width="55%" height={14} style={{ marginTop: 8 }} borderRadius={6} />
          <Skeleton width="100%" height={34} borderRadius={12} style={{ marginTop: 10 }} />
        </View>
      ))}
    </View>
  );
};

// ── New: Home screen skeleton ───────────────────────────────────────────────

export const HomeScreenSkeleton = () => {
  const { colors } = useTheme();
  const statW = (width - 18 * 2 - 10 * 2) / 3;
  return (
    <View style={{ paddingHorizontal: 18 }}>
      {/* Stats row */}
      <Row style={{ gap: 10, marginTop: 12, marginBottom: 22 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.statCard, { width: statW, backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <Skeleton width={32} height={32} borderRadius={10} />
            <Skeleton width="80%" height={16} borderRadius={6} style={{ marginTop: 10 }} />
            <Skeleton width="60%" height={11} borderRadius={4} style={{ marginTop: 5 }} />
          </View>
        ))}
      </Row>

      {/* Section: Recent Orders */}
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Skeleton width={120} height={16} borderRadius={6} />
        <Skeleton width={55} height={13} borderRadius={6} />
      </Row>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.orderCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Skeleton width="50%" height={14} borderRadius={6} />
            <Skeleton width="35%" height={11} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Skeleton width={70} height={14} borderRadius={6} />
            <Skeleton width={60} height={20} borderRadius={20} />
          </View>
        </View>
      ))}

      {/* Section: Products */}
      <Row style={{ justifyContent: 'space-between', marginTop: 22, marginBottom: 12 }}>
        <Skeleton width={90} height={16} borderRadius={6} />
        <Skeleton width={65} height={13} borderRadius={6} />
      </Row>
      <Row style={{ gap: 12 }}>
        {[1, 2].map((i) => (
          <View key={i} style={[styles.miniProductCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <Skeleton width="100%" height={78} borderRadius={12} />
            <Skeleton width="80%" height={13} borderRadius={6} style={{ marginTop: 10 }} />
            <Skeleton width="50%" height={14} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
        ))}
      </Row>
    </View>
  );
};

// ── New: Order list skeleton ────────────────────────────────────────────────

export const OrderListSkeleton = () => {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.orderCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Skeleton width={10} height={10} borderRadius={5} style={{ marginRight: 14 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Skeleton width="40%" height={14} borderRadius={6} />
              <Skeleton width="25%" height={14} borderRadius={6} />
            </Row>
            <Skeleton width="55%" height={11} borderRadius={4} />
            <Skeleton width={64} height={20} borderRadius={20} />
          </View>
        </View>
      ))}
    </View>
  );
};

// ── New: Ledger skeleton ────────────────────────────────────────────────────

export const LedgerSkeleton = () => {
  const { colors } = useTheme();
  const sumW = (width - 18 * 2 - 10 * 2) / 3;
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
      {/* Summary row */}
      <Row style={{ gap: 10, marginBottom: 14 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.statCard, { width: sumW, backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <Skeleton width={32} height={32} borderRadius={10} />
            <Skeleton width="80%" height={13} borderRadius={6} style={{ marginTop: 10 }} />
            <Skeleton width="60%" height={10} borderRadius={4} style={{ marginTop: 5 }} />
          </View>
        ))}
      </Row>

      {/* Account card */}
      <View style={[styles.accountCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        {[1, 2, 3].map((i) => (
          <Row key={i} style={{ gap: 12, marginBottom: 10 }}>
            <Skeleton width={34} height={34} borderRadius={10} />
            <View style={{ flex: 1, gap: 5 }}>
              <Skeleton width="35%" height={11} borderRadius={4} />
              <Skeleton width="65%" height={14} borderRadius={6} />
            </View>
          </Row>
        ))}
      </View>

      {/* Transaction rows */}
      <Row style={{ justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
        <Skeleton width={110} height={16} borderRadius={6} />
        <Skeleton width={70} height={12} borderRadius={4} />
      </Row>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.txCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <Skeleton width={40} height={40} borderRadius={12} style={{ marginRight: 12 }} />
          <View style={{ flex: 1, gap: 5 }}>
            <Skeleton width="55%" height={13} borderRadius={6} />
            <Skeleton width="40%" height={11} borderRadius={4} />
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <Skeleton width={70} height={14} borderRadius={6} />
            <Skeleton width={40} height={11} borderRadius={4} />
          </View>
        </View>
      ))}
    </View>
  );
};

// ── Existing: Profile skeleton ─────────────────────────────────────────────

export const ProfileSkeleton = () => {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: 18 }}>
      {/* Avatar section */}
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Skeleton width={80} height={80} borderRadius={40} />
        <Skeleton width={160} height={20} borderRadius={8} style={{ marginTop: 14 }} />
        <Skeleton width={80} height={26} borderRadius={20} style={{ marginTop: 8 }} />
      </View>

      {/* Info card 1 */}
      <View style={[styles.profileCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <Skeleton width="50%" height={15} borderRadius={6} style={{ marginBottom: 14 }} />
        {[1, 2, 3, 4].map((i) => (
          <Row key={i} style={{ gap: 12, marginBottom: 14 }}>
            <Skeleton width={34} height={34} borderRadius={10} />
            <View style={{ flex: 1, gap: 5 }}>
              <Skeleton width="30%" height={11} borderRadius={4} />
              <Skeleton width="70%" height={14} borderRadius={6} />
            </View>
          </Row>
        ))}
      </View>

      {/* Info card 2 */}
      <View style={[styles.profileCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <Skeleton width="40%" height={15} borderRadius={6} style={{ marginBottom: 14 }} />
        {[1, 2].map((i) => (
          <Row key={i} style={{ gap: 12, marginBottom: 14 }}>
            <Skeleton width={34} height={34} borderRadius={10} />
            <View style={{ flex: 1, gap: 5 }}>
              <Skeleton width="30%" height={11} borderRadius={4} />
              <Skeleton width="55%" height={14} borderRadius={6} />
            </View>
          </Row>
        ))}
      </View>
    </View>
  );
};

// ── Existing: About screen skeleton ───────────────────────────────────────

export const AboutScreenSkeleton = () => {
  return (
    <View style={styles.contentPadding}>
      <Skeleton width="100%" height={200} borderRadius={15} />
      <Skeleton width="60%" height={25} style={{ marginTop: 30 }} />
      <Skeleton width="100%" height={15} style={{ marginTop: 20 }} />
      <Skeleton width="100%" height={15} style={{ marginTop: 10 }} />
      <Skeleton width="100%" height={15} style={{ marginTop: 10 }} />
      <Skeleton width="80%" height={15} style={{ marginTop: 10 }} />
      <Skeleton width="40%" height={20} style={{ marginTop: 40 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 30 }}>
        <Skeleton width={60} height={60} borderRadius={30} />
        <Skeleton width={60} height={60} borderRadius={30} />
        <Skeleton width={60} height={60} borderRadius={30} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    paddingTop: 6,
    gap: 12,
  },
  productCard: {
    width: CARD_W,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 0,
  },
  miniProductCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
  },
  statCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  accountCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  contentPadding: {
    padding: 20,
  },
});
