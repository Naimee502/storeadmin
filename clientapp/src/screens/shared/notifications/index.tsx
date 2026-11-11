import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../config';
import { BackHeader, DynamicFlashList } from '../../../components';
import {
  GET_NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
  MARK_ALL_NOTIFICATIONS_READ,
} from '../../../apollo/queries/notifications';
import type { RootState } from '../../../store/rootreducer';

const TYPE_META: Record<string, { icon: string; color: string }> = {
  order:      { icon: 'clipboard-check-outline', color: '#3b82f6' },
  invoice:    { icon: 'file-document-outline',   color: '#3b82f6' },
  payment:    { icon: 'cash-check',              color: '#22c55e' },
  offer:      { icon: 'tag-outline',             color: '#f59e0b' },
  attendance: { icon: 'calendar-check-outline',  color: '#14b8a6' },
  party:      { icon: 'account-plus-outline',    color: '#8b5cf6' },
  route:      { icon: 'map-marker-path',         color: '#f97316' },
  system:     { icon: 'information-outline',     color: '#8b5cf6' },
};

const timeAgo = (iso?: string) => {
  if (!iso) return '';
  const t = isNaN(Number(iso)) ? new Date(iso).getTime() : Number(iso);
  const diff = Date.now() - t;
  if (isNaN(diff)) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return `${Math.floor(d / 7)} week${d >= 14 ? 's' : ''} ago`;
};

export default function Notifications() {
  const { colors, isDark } = useTheme();

  const user   = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);

  const filter = {
    adminid: tenant?.adminId,
    targettype: user?.role === 'party' ? 'party' : 'staff',
    targetid: user?.id,
    limit: 100,
  };

  const { data, refetch } = useQuery(GET_NOTIFICATIONS, {
    variables: { filter },
    skip: !tenant?.adminId || !user?.id,
    fetchPolicy: 'cache-and-network',
  });
  const [markRead]    = useMutation(MARK_NOTIFICATION_READ);
  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  const notifs: any[] = useMemo(() => (data as any)?.getNotifications ?? [], [data]);
  const unreadCount = notifs.filter(n => !n.read).length;

  const handleMarkAll = async () => {
    try { await markAllRead({ variables: { filter } }); } catch { /* best-effort */ }
    refetch();
  };

  // Tap only marks the notification read — no navigation for now.
  const handleTap = async (n: any) => {
    if (!n.read) {
      try { await markRead({ variables: { id: n.id } }); } catch { /* best-effort */ }
      refetch();
    }
  };

  const renderNotif = ({ item: n }: { item: any }) => {
    const meta = TYPE_META[n.ntype] ?? TYPE_META.system;
    return (
      <Pressable
        style={[styles.row, { backgroundColor: colors.cardGlass, borderColor: n.read ? colors.border : colors.brand }]}
        onPress={() => handleTap(n)}
      >
        <View style={[styles.iconChip, { backgroundColor: meta.color + '18' }]}>
          <Icon name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{n.title}</Text>
            {!n.read && <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} />}
          </View>
          <Text style={[styles.body, { color: colors.subText }]} numberOfLines={2}>{n.message}</Text>
          <View style={styles.timeRow}>
            <Icon name="clock-outline" size={11} color={colors.subText} style={{ marginRight: 3 }} />
            <Text style={[styles.time, { color: colors.subText }]}>{timeAgo(n.createdAt)}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const ListHeader = () => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent</Text>
      {unreadCount > 0 ? (
        <View style={styles.headRight}>
          <View style={[styles.unreadBadge, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.unreadText, { color: colors.brand }]}>{unreadCount} unread</Text>
          </View>
          <Pressable onPress={handleMarkAll} hitSlop={8}>
            <Text style={[styles.markAll, { color: colors.brand }]}>Mark all read</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.countText, { color: colors.subText }]}>{notifs.length} notification{notifs.length !== 1 ? 's' : ''}</Text>
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
        estimatedItemSize={84}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Icon name="bell-off-outline" size={42} color={colors.border} />
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

  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 14, marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontFamily: FONTS.bold },
  countText:    { fontSize: 12, fontFamily: FONTS.regular },
  headRight:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unreadBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  unreadText:   { fontSize: 10, fontFamily: FONTS.semiBold },
  markAll:      { fontSize: 12, fontFamily: FONTS.semiBold },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  iconChip:  { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  title:     { fontSize: 13, fontFamily: FONTS.bold, flex: 1 },
  unreadDot: { width: 7, height: 7, borderRadius: 4 },
  body:      { fontSize: 12, fontFamily: FONTS.regular, lineHeight: 17, marginBottom: 6 },
  timeRow:   { flexDirection: 'row', alignItems: 'center' },
  time:      { fontSize: 11, fontFamily: FONTS.regular },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.semiBold },
});
