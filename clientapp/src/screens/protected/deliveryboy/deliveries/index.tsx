import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { AppHeader, DynamicFlashList } from '../../../../components';
import { formatINR } from '../../../../utils';

type FilterKey = 'all' | 'pending' | 'delivered' | 'failed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'pending',   label: 'Pending'   },
  { key: 'delivered', label: 'Delivered' },
  { key: 'failed',    label: 'Failed'    },
];

const STATUS_META: Record<string, { color: string; icon: string }> = {
  pending:   { color: '#f59e0b', icon: 'clock-outline'         },
  delivered: { color: '#22c55e', icon: 'check-circle-outline'  },
  failed:    { color: '#ef4444', icon: 'close-circle-outline'  },
};

const DUMMY_DELIVERIES = [
  { id: 'd1', orderNum: 'SO/2024/021', party: 'Mehta Traders',   address: 'Shop 12, North Market, Sector 4',  amount: 4200,  status: 'pending',   cashCollected: 0     },
  { id: 'd2', orderNum: 'SO/2024/020', party: 'Patel General',   address: 'Main Rd, Near SBI Bank',           amount: 8750,  status: 'delivered', cashCollected: 8750  },
  { id: 'd3', orderNum: 'SO/2024/019', party: 'Sharma Stores',   address: 'Opp. Old Bus Stand',               amount: 2300,  status: 'pending',   cashCollected: 0     },
  { id: 'd4', orderNum: 'SO/2024/018', party: 'Gupta Kirana',    address: 'Near Post Office, West Block',     amount: 6400,  status: 'failed',    cashCollected: 0     },
  { id: 'd5', orderNum: 'SO/2024/017', party: 'Shah Stores',     address: 'Plot 5, Industrial Area',          amount: 1850,  status: 'pending',   cashCollected: 0     },
  { id: 'd6', orderNum: 'SO/2024/016', party: 'Modi Mart',       address: 'Laxmi Nagar, Main Chowk',          amount: 9200,  status: 'delivered', cashCollected: 9200  },
];

export default function DeliveryList() {
  const { colors, isDark } = useTheme();
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return DUMMY_DELIVERIES;
    return DUMMY_DELIVERIES.filter(d => d.status === filter);
  }, [filter]);

  const counts = useMemo(() => ({
    all:       DUMMY_DELIVERIES.length,
    pending:   DUMMY_DELIVERIES.filter(d => d.status === 'pending').length,
    delivered: DUMMY_DELIVERIES.filter(d => d.status === 'delivered').length,
    failed:    DUMMY_DELIVERIES.filter(d => d.status === 'failed').length,
  }), []);

  const handleMarkDelivered = (item: any) =>
    Alert.alert('Mark Delivered', `Mark ${item.orderNum} as delivered?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => {} },
    ]);

  const renderItem = ({ item }: any) => {
    const meta = STATUS_META[item.status];
    return (
      <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
          <Icon name="truck-delivery-outline" size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTop}>
            <Text style={[styles.orderNum, { color: colors.text }]}>{item.orderNum}</Text>
            <Text style={[styles.amount, { color: colors.text }]}>{formatINR(item.amount)}</Text>
          </View>
          <Text style={[styles.partyName, { color: colors.text }]} numberOfLines={1}>{item.party}</Text>
          <View style={styles.addressRow}>
            <Icon name="map-marker-outline" size={11} color={colors.subText} style={{ marginRight: 3 }} />
            <Text style={[styles.address, { color: colors.subText }]} numberOfLines={1}>{item.address}</Text>
          </View>
          <View style={styles.cardBottom}>
            <View style={[styles.statusBadge, { backgroundColor: meta.color + '22' }]}>
              <Icon name={meta.icon} size={11} color={meta.color} style={{ marginRight: 3 }} />
              <Text style={[styles.statusText, { color: meta.color }]}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
            {item.status === 'pending' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.brand }]}
                onPress={() => handleMarkDelivered(item)}
              >
                <Text style={styles.actionBtnText}>Mark Delivered</Text>
              </TouchableOpacity>
            )}
            {item.cashCollected > 0 && (
              <Text style={[styles.cashText, { color: '#22c55e' }]}>₹{item.cashCollected} collected</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <AppHeader label="Deliveries" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} style={styles.chipScroll}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count  = counts[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active
                ? { backgroundColor: colors.brand,         borderColor: colors.brand }
                : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
              ]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, { color: active ? '#fff' : colors.subText }]}>{f.label}</Text>
              {count > 0 && (
                <View style={[styles.chipCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : colors.brandSoft }]}>
                  <Text style={[styles.chipCountText, { color: active ? '#fff' : colors.brand }]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <DynamicFlashList
        data={filtered}
        renderItem={renderItem}
        estimatedItemSize={110}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="truck-outline" size={44} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>No {filter} deliveries</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  chipScroll: { flexGrow: 0 },
  chipList:   { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
  },
  chipText:      { fontSize: 13, fontFamily: FONTS.semiBold },
  chipCount:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: 'center' },
  chipCountText: { fontSize: 11, fontFamily: FONTS.bold },

  listContent: { paddingHorizontal: 18, paddingBottom: 110, paddingTop: 4 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  iconWrap:    { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  orderNum:    { fontSize: 13, fontFamily: FONTS.bold },
  amount:      { fontSize: 13, fontFamily: FONTS.bold },
  partyName:   { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 3 },
  addressRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  address:     { fontSize: 11, fontFamily: FONTS.regular, flex: 1 },
  cardBottom:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText:  { fontSize: 11, fontFamily: FONTS.semiBold },
  actionBtn:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  actionBtnText: { fontSize: 12, fontFamily: FONTS.bold, color: '#fff' },
  cashText:    { fontSize: 12, fontFamily: FONTS.semiBold },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
