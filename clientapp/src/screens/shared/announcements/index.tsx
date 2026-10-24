import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, StatusBar, Alert, Modal, Image, Linking,
  KeyboardAvoidingView, Platform, ScrollView, TextInput, ActivityIndicator, Switch,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { FONTS, COLORS, useTheme, resolveMediaUrl } from '../../../config';
import { BackHeader, DynamicFlashList } from '../../../components';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { uploadImage } from '../../../utils/uploadimage';
import {
  GET_MY_ANNOUNCEMENTS, GET_SENT_ANNOUNCEMENTS, GET_ANNOUNCEMENT_TARGETS,
  ADD_ANNOUNCEMENT, DELETE_ANNOUNCEMENT, MARK_ANNOUNCEMENT_READ,
} from '../../../apollo/queries/announcements';
import type { RootState } from '../../../store/rootreducer';

/**
 * Announcements
 *   Inbox — notices sent to this user (by the business, their salesman or
 *           their parent party).
 *   Sent  — salesmen (to their parties) and channel parties (to their
 *           sub-parties) can send their own; the server decides who they may
 *           reach, the composer only offers those people.
 */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const SENDER: Record<string, string> = { admin: 'Admin', branch: 'Branch', staff: 'Salesman', party: 'Distributor' };

export default function AnnouncementsScreen() {
  const { colors, isDark } = useTheme();
  const role = useSelector((s: RootState) => s.auth.user?.role ?? 'party');

  const inbox = useQuery(GET_MY_ANNOUNCEMENTS, { fetchPolicy: 'cache-and-network' });
  const sent = useQuery(GET_SENT_ANNOUNCEMENTS, { fetchPolicy: 'cache-and-network', skip: role !== 'salesman' && role !== 'party' });
  const targetsQ = useQuery(GET_ANNOUNCEMENT_TARGETS, { fetchPolicy: 'cache-and-network', skip: role !== 'salesman' && role !== 'party' });
  const [markRead] = useMutation(MARK_ANNOUNCEMENT_READ, { refetchQueries: ['GetMyAnnouncements'] });
  const [addAnn] = useMutation(ADD_ANNOUNCEMENT, { refetchQueries: ['GetSentAnnouncements'] });
  const [deleteAnn] = useMutation(DELETE_ANNOUNCEMENT, { refetchQueries: ['GetSentAnnouncements'] });

  useFocusEffect(useCallback(() => { inbox.refetch?.(); }, [inbox.refetch]));

  const parties: any[] = (targetsQ.data as any)?.getAnnouncementTargets?.parties ?? [];
  const canSend = (role === 'salesman' || role === 'party') && parties.length > 0;
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [open, setOpen] = useState<any>(null);
  const [picture, setPicture] = useState<string | null>(null);

  const items: any[] = tab === 'inbox'
    ? ((inbox.data as any)?.getMyAnnouncements ?? [])
    : ((sent.data as any)?.getSentAnnouncements ?? []);

  const openItem = (a: any) => {
    setOpen(a);
    if (tab === 'inbox' && !a.read) markRead({ variables: { id: a.id } }).catch(() => {});
  };

  /* ── composer ───────────────────────────────────────── */
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [toAll, setToAll] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [imageurl, setImageurl] = useState('');
  const [uploading, setUploading] = useState(false);

  // Offer / festival banner (e.g. "Diwali Sale"). Wide pictures look best.
  const pickImage = () => {
    const handle = async (result: any) => {
      const asset = result?.assets?.[0];
      if (!asset?.uri) return;
      setUploading(true);
      try {
        setImageurl(await uploadImage(asset.uri, asset.fileName, asset.type));
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message || 'Could not upload the picture.');
      } finally {
        setUploading(false);
      }
    };
    const opts: any = { mediaType: 'photo', quality: 0.7, maxWidth: 1280, maxHeight: 1280 };
    Alert.alert('Add Picture', 'Banner or offer image for this announcement', [
      { text: 'Gallery', onPress: () => launchImageLibrary(opts).then(handle).catch(() => {}) },
      { text: 'Camera', onPress: () => launchCamera(opts).then(handle).catch(() => {}) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const allLabel = role === 'salesman' ? 'All my parties' : 'All my sub-parties';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? parties.filter(p => `${p.name} ${p.sub ?? ''}`.toLowerCase().includes(q)) : parties;
  }, [parties, search]);

  const resetComposer = () => { setTitle(''); setMessage(''); setImageurl(''); setToAll(true); setPicked([]); setSearch(''); };

  const send = async () => {
    if (!title.trim()) { Alert.alert('Title', 'Enter a title.'); return; }
    if (!toAll && picked.length === 0) { Alert.alert('Recipients', 'Pick at least one party.'); return; }
    setSending(true);
    try {
      const audience = role === 'salesman'
        ? { myParties: toAll, partyIds: toAll ? [] : picked }
        : { mySubParties: toAll, partyIds: toAll ? [] : picked };
      const { data } = await addAnn({ variables: { input: { title: title.trim(), message: message.trim(), imageurl, audience } } });
      setComposing(false);
      resetComposer();
      setTab('sent');
      Alert.alert('Sent', `Announcement sent to ${(data as any)?.addAnnouncement?.recipientcount ?? 0} parties.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  const onDelete = (a: any) => {
    Alert.alert('Delete', `Delete "${a.title}"? It disappears for everyone.`, [
      { text: 'No', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteAnn({ variables: { id: a.id } }).catch((e: any) => Alert.alert('Error', e?.message)); setOpen(null); } },
    ]);
  };

  const renderItem = ({ item: a }: any) => {
    const unread = tab === 'inbox' && !a.read;
    return (
      <Pressable
        onPress={() => openItem(a)}
        style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: unread ? colors.brand : colors.border }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: (a.priority === 'important' ? '#ef4444' : colors.brand) + '18' }]}>
          <Icon name={a.priority === 'important' ? 'alert-decagram-outline' : 'bullhorn-outline'} size={20} color={a.priority === 'important' ? '#ef4444' : colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{a.title}</Text>
            {unread && <View style={[styles.dot, { backgroundColor: colors.brand }]} />}
          </View>
          {!!a.message && <Text style={[styles.msg, { color: colors.subText }]} numberOfLines={2}>{a.message}</Text>}
          <View style={styles.rowBetween}>
            <Text style={[styles.meta, { color: colors.subText, flex: 1 }]} numberOfLines={1}>
              {tab === 'inbox'
                ? `${a.sendername || SENDER[a.sendertype] || ''} · ${fmt(a.startAt)}`
                : `${a.audienceLabel} · seen ${a.readcount}/${a.recipientcount} · ${fmt(a.startAt)}`}
            </Text>
            {/* Picture stays out of the list (keeps rows small); tap to view it. */}
            {!!a.imageurl && (
              <Pressable
                style={styles.attach}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => {
                  setPicture(a.imageurl);
                  if (tab === 'inbox' && !a.read) markRead({ variables: { id: a.id } }).catch(() => {});
                }}
              >
                <Icon name="paperclip" size={13} color={colors.subText} />
                <Icon name="image-outline" size={14} color={colors.subText} />
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label="Announcements" />

      {canSend && (
        <View style={[styles.tabs, { backgroundColor: colors.raisedSurface }]}>
          {(['inbox', 'sent'] as const).map(t => (
            <Pressable key={t} style={[styles.tab, tab === t && { backgroundColor: colors.brand }]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, { color: tab === t ? colors.onBrand : colors.subText }]}>{t === 'inbox' ? 'Inbox' : 'Sent'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <DynamicFlashList
        data={items}
        renderItem={renderItem}
        estimatedItemSize={90}
        ListEmptyComponent={
          (tab === 'inbox' ? inbox.loading : sent.loading)
            ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.brand} />
            : <Text style={[styles.empty, { color: colors.subText }]}>{tab === 'inbox' ? 'No announcements yet.' : 'You have not sent any announcements.'}</Text>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {canSend && (
        <Pressable style={[styles.fab, { backgroundColor: colors.brand }]} onPress={() => { resetComposer(); setComposing(true); }}>
          <Icon name="bullhorn" size={20} color={colors.onBrand} />
          <Text style={[styles.fabText, { color: colors.onBrand }]}>New</Text>
        </Pressable>
      )}

      {/* Detail */}
      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={styles.overlayCenter}>
          <View style={[styles.detail, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {open?.priority === 'important' && <Text style={styles.importantTag}>IMPORTANT</Text>}
              <Text style={[styles.detailTitle, { color: colors.text }]}>{open?.title}</Text>
              <Text style={[styles.meta, { color: colors.subText, marginBottom: 12 }]}>
                {open?.sendername || SENDER[open?.sendertype] || ''} · {fmt(open?.startAt)}
              </Text>
              {!!open?.imageurl && (
                <Pressable onPress={() => setPicture(open.imageurl)} style={[styles.linkRow, { marginTop: 0, marginBottom: 10 }]}>
                  <Icon name="paperclip" size={15} color={colors.brand} />
                  <Text style={[styles.link, { color: colors.brand }]}>View picture</Text>
                </Pressable>
              )}
              {!!open?.message && <Text style={[styles.detailMsg, { color: colors.text }]}>{open.message}</Text>}
              {!!open?.link && (
                <Pressable onPress={() => Linking.openURL(open.link).catch(() => {})} style={styles.linkRow}>
                  <Icon name="open-in-new" size={15} color={colors.brand} />
                  <Text style={[styles.link, { color: colors.brand }]} numberOfLines={1}>{open.link}</Text>
                </Pressable>
              )}
              {tab === 'sent' && (
                <Text style={[styles.meta, { color: colors.subText, marginTop: 12 }]}>
                  To: {open?.audienceLabel} · seen by {open?.readcount} of {open?.recipientcount}
                </Text>
              )}
            </ScrollView>
            <View style={styles.detailBtns}>
              {tab === 'sent' && (
                <Pressable onPress={() => onDelete(open)} style={[styles.btn, { borderColor: '#ef444466' }]}>
                  <Text style={{ color: '#ef4444', fontFamily: FONTS.semiBold }}>Delete</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setOpen(null)} style={[styles.btn, { backgroundColor: colors.brand, borderColor: colors.brand }]}>
                <Text style={{ color: colors.onBrand, fontFamily: FONTS.semiBold }}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Picture viewer */}
      <Modal visible={!!picture} transparent animationType="fade" onRequestClose={() => setPicture(null)}>
        <Pressable style={styles.pictureWrap} onPress={() => setPicture(null)}>
          {!!picture && <Image source={{ uri: resolveMediaUrl(picture) }} style={styles.pictureImg} resizeMode="contain" />}
          <View style={styles.pictureClose}><Icon name="close" size={20} color="#fff" /></View>
        </Pressable>
      </Modal>

      {/* Composer */}
      <Modal visible={composing} animationType="slide" transparent onRequestClose={() => setComposing(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setComposing(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
            <View style={[styles.sheet, { backgroundColor: colors.background }]}>
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>New Announcement</Text>
                <Pressable onPress={() => setComposing(false)}><Icon name="close" size={20} color={colors.subText} /></Pressable>
              </View>
              <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <Text style={[styles.label, { color: colors.text }]}>Title</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                  value={title} onChangeText={setTitle} placeholder="e.g. New scheme from Monday" placeholderTextColor={colors.subText} />
                <Text style={[styles.label, { color: colors.text }]}>Message</Text>
                <TextInput style={[styles.input, { minHeight: 90, color: colors.text, backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                  value={message} onChangeText={setMessage} multiline textAlignVertical="top" placeholder="Write your message…" placeholderTextColor={colors.subText} />

                <Text style={[styles.label, { color: colors.text }]}>Picture (optional)</Text>
                {imageurl ? (
                  <View style={styles.composeImgWrap}>
                    <Image source={{ uri: resolveMediaUrl(imageurl, 800) }} style={styles.composeImg} resizeMode="cover" />
                    <Pressable style={styles.composeImgRemove} onPress={() => setImageurl('')}>
                      <Icon name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={[styles.composeImgAdd, { borderColor: colors.border }]} onPress={pickImage} disabled={uploading}>
                    {uploading
                      ? <ActivityIndicator color={colors.brand} />
                      : <>
                          <Icon name="image-plus" size={24} color={colors.subText} />
                          <Text style={[styles.meta, { color: colors.subText }]}>Add offer banner / picture</Text>
                        </>}
                  </Pressable>
                )}

                <View style={[styles.switchRow, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                  <Text style={[styles.label, { color: colors.text, marginTop: 0, marginBottom: 0, flex: 1 }]}>{allLabel} ({parties.length})</Text>
                  <Switch value={toAll} onValueChange={setToAll} trackColor={{ false: colors.border, true: colors.brand + '88' }} thumbColor={toAll ? colors.brand : colors.subText} />
                </View>

                {!toAll && (
                  <>
                    <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                      value={search} onChangeText={setSearch} placeholder="Search party…" placeholderTextColor={colors.subText} />
                    <Text style={[styles.meta, { color: colors.subText, marginBottom: 6 }]}>{picked.length} selected</Text>
                    {filtered.slice(0, 200).map(p => {
                      const on = picked.includes(p.id);
                      return (
                        <Pressable key={p.id} style={[styles.partyRow, { borderColor: colors.border }]}
                          onPress={() => setPicked(x => (on ? x.filter(i => i !== p.id) : [...x, p.id]))}>
                          <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={on ? colors.brand : colors.subText} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.partyName, { color: colors.text }]}>{p.name}</Text>
                            {!!p.sub && <Text style={[styles.meta, { color: colors.subText }]}>{p.sub}</Text>}
                          </View>
                        </Pressable>
                      );
                    })}
                  </>
                )}

              </ScrollView>
              <View style={{ paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                <Pressable style={[styles.sendBtn, { backgroundColor: sending || uploading ? colors.border : colors.brand }]} onPress={send} disabled={sending || uploading}>
                  <Icon name="send-outline" size={16} color={colors.onBrand} />
                  <Text style={[styles.sendText, { color: colors.onBrand }]}>{sending ? 'Sending…' : 'Send'}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 100 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tabs: { flexDirection: 'row', marginHorizontal: 18, marginTop: 12, borderRadius: 12, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  tabText: { fontSize: 13, fontFamily: FONTS.semiBold },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 13, fontFamily: FONTS.regular },

  card: { flexDirection: 'row', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10, shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 14, fontFamily: FONTS.bold, flex: 1 },
  msg: { fontSize: 12, fontFamily: FONTS.regular, marginTop: 2 },
  meta: { fontSize: 11, fontFamily: FONTS.regular, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  fab: { position: 'absolute', right: 20, bottom: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 28, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  fabText: { fontSize: 14, fontFamily: FONTS.bold },

  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  detail: { borderRadius: 20, maxHeight: '85%', overflow: 'hidden' },
  importantTag: { alignSelf: 'flex-start', backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: 10, fontFamily: FONTS.bold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 8 },
  detailTitle: { fontSize: 18, fontFamily: FONTS.bold },
  detailImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 12 },
  detailMsg: { fontSize: 14, fontFamily: FONTS.regular, lineHeight: 21 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  link: { fontSize: 13, fontFamily: FONTS.semiBold, flex: 1 },
  detailBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 14 },
  btn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  kav: { maxHeight: '92%', width: '100%' },
  sheet: { maxHeight: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 20, overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  sheetTitle: { fontSize: 17, fontFamily: FONTS.bold },
  label: { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 8, marginTop: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 14, fontFamily: FONTS.regular, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 8 },
  partyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  partyName: { fontSize: 13, fontFamily: FONTS.semiBold },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 14, marginTop: 12 },
  sendText: { fontSize: 15, fontFamily: FONTS.bold },

  attach: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8, marginTop: 4 },
  pictureWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  pictureImg: { width: '94%', height: '80%' },
  pictureClose: { position: 'absolute', top: 48, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  bannerCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden', shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  bannerImg: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#00000010' },
  bannerBody: { paddingHorizontal: 12, paddingVertical: 10 },
  composeImgWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  composeImg: { width: '100%', aspectRatio: 16 / 9 },
  composeImgRemove: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  composeImgAdd: { height: 90, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4, marginBottom: 8 },
});
