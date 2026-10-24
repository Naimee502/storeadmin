import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { useQuery, useMutation } from '@apollo/client/react';
import { FONTS, useTheme, resolveMediaUrl } from '../config';
import { GET_MY_ANNOUNCEMENTS, MARK_ANNOUNCEMENT_READ } from '../apollo/queries/announcements';

/**
 * "Important" announcements pop up once, the next time the app is opened.
 * Closing it marks it read, so it never comes back. Rendered only while the
 * Announcements module is on (the drawer decides that).
 */
export const AnnouncementPopup = () => {
  const { colors } = useTheme();
  const { data } = useQuery(GET_MY_ANNOUNCEMENTS, { fetchPolicy: 'cache-and-network' });
  const [markRead] = useMutation(MARK_ANNOUNCEMENT_READ, { refetchQueries: ['GetMyAnnouncements'] });
  const [shown, setShown] = useState<any>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (shown) return;
    const next = ((data as any)?.getMyAnnouncements ?? []).find(
      (a: any) => a.priority === 'important' && !a.read && !dismissed.has(a.id),
    );
    if (next) setShown(next);
  }, [data, shown, dismissed]);

  if (!shown) return null;

  const close = () => {
    markRead({ variables: { id: shown.id } }).catch(() => {});
    setDismissed(prev => new Set(prev).add(shown.id));
    setShown(null);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={[styles.box, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.tag}>📢 IMPORTANT</Text>
            <Text style={[styles.title, { color: colors.text }]}>{shown.title}</Text>
            {!!shown.imageurl && (
              <Image source={{ uri: resolveMediaUrl(shown.imageurl, 800) }} style={styles.img} resizeMode="cover" />
            )}
            {!!shown.message && <Text style={[styles.msg, { color: colors.text }]}>{shown.message}</Text>}
            {!!shown.sendername && <Text style={[styles.from, { color: colors.subText }]}>— {shown.sendername}</Text>}
          </ScrollView>
          <Pressable style={[styles.btn, { backgroundColor: colors.brand }]} onPress={close}>
            <Text style={[styles.btnText, { color: colors.onBrand }]}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  box: { borderRadius: 20, maxHeight: '80%', overflow: 'hidden' },
  tag: { color: '#b91c1c', fontSize: 11, fontFamily: FONTS.bold, marginBottom: 6 },
  title: { fontSize: 18, fontFamily: FONTS.bold, marginBottom: 10 },
  img: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 12 },
  msg: { fontSize: 14, fontFamily: FONTS.regular, lineHeight: 21 },
  from: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 10 },
  btn: { margin: 16, marginTop: 4, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 15, fontFamily: FONTS.bold },
});
