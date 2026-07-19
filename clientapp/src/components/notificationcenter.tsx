import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../config';
import {
  GET_NOTIFICATIONS,
  MARK_NOTIFICATION_READ,
  MARK_ALL_NOTIFICATIONS_READ,
} from '../apollo/queries/notifications';
import type { RootState } from '../store/rootreducer';

const TYPE_ICON: Record<string, { name: string; color: string }> = {
  order: { name: 'clipboard-text-outline', color: '#f59e0b' },
  invoice: { name: 'file-document-outline', color: '#3b82f6' },
  payment: { name: 'cash-multiple', color: '#22c55e' },
  attendance: { name: 'calendar-check-outline', color: '#14b8a6' },
  party: { name: 'account-plus-outline', color: '#8b5cf6' },
  route: { name: 'map-marker-path', color: '#f97316' },
  system: { name: 'bell-outline', color: '#64748b' },
};

const timeAgo = (iso?: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** Hook: gives a header bell icon (for AppHeader rightIcons) + the modal UI.
    Usage:
      const { bellIcon, NotificationsModal } = useNotificationCenter();
      <AppHeader rightIcons={[bellIcon]} />
      {NotificationsModal}
*/
export const useNotificationCenter = () => {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  const user = useSelector((s: RootState) => s.auth.user);
  const tenant = useSelector((s: RootState) => s.tenant);

  const targettype = user?.role === 'party' ? 'party' : 'staff';
  const filter = {
    adminid: tenant?.adminId,
    targettype,
    targetid: user?.id,
    unreadOnly: true,
    limit: 30,
  };

  const { data, refetch } = useQuery(GET_NOTIFICATIONS, {
    variables: { filter },
    skip: !tenant?.adminId || !user?.id,
    pollInterval: 30000,
    fetchPolicy: 'network-only',
  });
  const [markRead] = useMutation(MARK_NOTIFICATION_READ);
  const [markAllRead] = useMutation(MARK_ALL_NOTIFICATIONS_READ);

  const notifications: any[] = useMemo(
    () => (data as any)?.getNotifications ?? [],
    [data]
  );
  const badge = notifications.length;

  // Tap only marks the notification read — no navigation for now.
  const handleTap = async (n: any) => {
    try { await markRead({ variables: { id: n.id } }); } catch { /* best-effort */ }
    refetch();
    setOpen(false);
  };

  const handleMarkAll = async () => {
    try { await markAllRead({ variables: { filter } }); } catch { /* best-effort */ }
    refetch();
  };

  const bellIcon = {
    id: 'notifications',
    name: 'bell-outline',
    color: colors.brand,
    badge,
    onPress: () => setOpen(true),
  };

  const NotificationsModal = (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.sheetHeader, { borderColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Notifications</Text>
            <View style={styles.headerRight}>
              {badge > 0 && (
                <TouchableOpacity onPress={handleMarkAll}>
                  <Text style={[styles.markAll, { color: colors.brand }]}>Mark all read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Icon name="close" size={20} color={colors.subText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          {badge === 0 ? (
            <View style={styles.emptyWrap}>
              <Icon name="bell-check-outline" size={40} color={colors.subText} />
              <Text style={[styles.emptyText, { color: colors.subText }]}>
                All caught up — no new notifications.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(n: any) => n.id}
              style={{ maxHeight: 420 }}
              renderItem={({ item: n }) => {
                const t = TYPE_ICON[n.ntype] || TYPE_ICON.system;
                return (
                  <TouchableOpacity
                    style={[styles.row, { borderColor: colors.border }]}
                    onPress={() => handleTap(n)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: t.color }]}>
                      <Icon name={t.name} size={20} color="#fff" />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                        {n.title}
                      </Text>
                      {!!n.message && (
                        <Text style={[styles.rowMsg, { color: colors.subText }]} numberOfLines={2}>
                          {n.message}
                        </Text>
                      )}
                      <Text style={[styles.rowTime, { color: colors.subText }]}>
                        {timeAgo(n.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.unreadDot, { backgroundColor: colors.brand }]} />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { bellIcon, badge, NotificationsModal };
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start',
    paddingTop: 90,
    paddingHorizontal: 16,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 16, fontFamily: FONTS.bold },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markAll: { fontSize: 12, fontFamily: FONTS.semiBold },
  closeBtn: { padding: 4 },
  emptyWrap: { alignItems: 'center', paddingVertical: 36, gap: 10 },
  emptyText: { fontSize: 13, fontFamily: FONTS.regular },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowIcon: {
    width: 38, height: 38, borderRadius: 19,
    justifyContent: 'center', alignItems: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 13.5, fontFamily: FONTS.bold },
  rowMsg: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  rowTime: { fontSize: 11, fontFamily: FONTS.regular, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
