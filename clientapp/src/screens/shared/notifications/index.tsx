import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../../../config';
import { BackHeader, DynamicFlashList } from '../../../components';

type NotifType = 'order' | 'payment' | 'offer' | 'system';

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const DUMMY_NOTIFS: Notif[] = [
  { id: 'n1', type: 'order',   title: 'Order Confirmed',       body: 'Your order SO/2024/005 has been confirmed by the seller.',              time: '2 min ago',   read: false },
  { id: 'n2', type: 'payment', title: 'Payment Received',      body: 'Payment of ₹5,000 received against your ledger account.',               time: '1 hr ago',    read: false },
  { id: 'n3', type: 'offer',   title: 'Special Offer',         body: 'Get 10% off on all Pulses & Lentils this week. Limited time deal!',     time: '3 hrs ago',   read: true  },
  { id: 'n4', type: 'order',   title: 'Order Dispatched',      body: 'Your order SO/2024/004 has been dispatched and is on the way.',          time: 'Yesterday',   read: true  },
  { id: 'n5', type: 'system',  title: 'App Updated',           body: 'Business Suite has been updated with new features and improvements.',   time: '2 days ago',  read: true  },
  { id: 'n6', type: 'payment', title: 'Credit Limit Updated',  body: 'Your credit limit has been updated to ₹75,000.',                        time: '3 days ago',  read: true  },
  { id: 'n7', type: 'offer',   title: 'New Products Added',    body: '12 new products have been added to the catalog. Check them out!',       time: '5 days ago',  read: true  },
  { id: 'n8', type: 'order',   title: 'Order Delivered',       body: 'Your order SO/2024/003 has been successfully delivered.',               time: '1 week ago',  read: true  },
];

const TYPE_META: Record<NotifType, { icon: string; color: string }> = {
  order:   { icon: 'clipboard-check-outline', color: '#3b82f6' },
  payment: { icon: 'cash-check',              color: '#22c55e' },
  offer:   { icon: 'tag-outline',             color: '#f59e0b' },
  system:  { icon: 'information-outline',     color: '#8b5cf6' },
};

export default function Notifications() {
  const { colors, isDark } = useTheme();
  const [notifs, setNotifs] = useState<Notif[]>(DUMMY_NOTIFS);

  const unreadCount = notifs.filter(n => !n.read).length;

  const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, read: true })));

  const markRead = (id: string) =>
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

  const renderNotif = ({ item: n }: { item: Notif }) => {
    const meta = TYPE_META[n.type];
    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.cardGlass, borderColor: colors.border },
          !n.read && { borderLeftColor: colors.brand, borderLeftWidth: 3 },
        ]}
        onPress={() => markRead(n.id)}
        activeOpacity={0.82}
      >
        <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
          <Icon name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{n.title}</Text>
            {!n.read && <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} />}
          </View>
          <Text style={[styles.body, { color: colors.subText }]} numberOfLines={2}>{n.body}</Text>
          <View style={styles.timeRow}>
            <Icon name="clock-outline" size={11} color={colors.subText} style={{ marginRight: 3 }} />
            <Text style={[styles.time, { color: colors.subText }]}>{n.time}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = () => (
    <View style={styles.listHeader}>
      {unreadCount > 0 ? (
        <View style={[styles.unreadBadge, { backgroundColor: colors.brandSoft }]}>
          <Text style={[styles.unreadText, { color: colors.brand }]}>{unreadCount} unread</Text>
        </View>
      ) : (
        <View />
      )}
      {unreadCount > 0 && (
        <TouchableOpacity onPress={markAllRead}>
          <Text style={[styles.markAll, { color: colors.brand }]}>Mark all read</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Notifications" />

      <DynamicFlashList
        data={notifs}
        renderItem={renderNotif}
        estimatedItemSize={90}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="bell-off-outline" size={48} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 40 },

  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: 14, paddingBottom: 10,
  },
  unreadBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  unreadText:  { fontSize: 12, fontFamily: FONTS.semiBold },
  markAll:     { fontSize: 13, fontFamily: FONTS.semiBold },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  iconWrap:  { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  title:     { fontSize: 13, fontFamily: FONTS.bold, flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  body:      { fontSize: 12, fontFamily: FONTS.regular, lineHeight: 17, marginBottom: 6 },
  timeRow:   { flexDirection: 'row', alignItems: 'center' },
  time:      { fontSize: 11, fontFamily: FONTS.regular },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },
});
