import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, Pressable, TextInput, ActivityIndicator, Image, Modal } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery } from '@apollo/client/react';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';
import { BOOK_APPOINTMENT, GET_BOOKABLE_SERVICES, GET_BOOKING_ON, GET_BOOKING_SLOTS } from '../../../../apollo/queries/booking';
import { useModuleEnabled } from '../../../../apollo/hooks/admin';
import type { RootState } from '../../../../store/rootreducer';

const istDay = (offset: number) => new Date(Date.now() + 330 * 60000 + offset * 86400000).toISOString().slice(0, 10);
const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const minutes = (d?: { amount?: number; unit?: string }) => Math.round((Number(d?.amount) || 0.5) * (d?.unit === 'minutes' ? 1 : 60));
const rupees = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const mins = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} hr${n % 60 ? ` ${n % 60} min` : ''}` : `${n} min`);
const PER: Record<string, string> = { visit: '/ visit', hour: '/ hour', session: '/ session', unit: '/ unit', room: '/ room', sqft: '/ sq ft' };
const WHERE: Record<string, string> = { onsite: 'At your place', offsite: 'At our store', remote: 'Online' };
const photosOf = (s: any): string[] => ((s?.imageurls || []).filter(Boolean).length ? s.imageurls.filter(Boolean) : s?.imageurl ? [s.imageurl] : []);
const facts = (v: any) => [
  v?.locationType && WHERE[v.locationType] && { icon: 'map-marker-outline', text: WHERE[v.locationType] },
  Number(v?.visitcharge) > 0 && { icon: 'truck-outline', text: `Visit charge ${rupees(v.visitcharge)}` },
  Number(v?.warrantydays) > 0 && { icon: 'shield-check-outline', text: `${v.warrantydays} days warranty` },
].filter(Boolean) as { icon: string; text: string }[];

/** Party books a service slot: service, day, free time, confirm. */
export default function BookingScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const appointmentsOn = useModuleEnabled('appointments');
  const adminid = useSelector((s: RootState) => (s as any).tenant?.adminId ?? '');
  const { data: onData } = useQuery(GET_BOOKING_ON, { variables: { adminid }, skip: !adminid });
  const { data: svcData, loading: svcLoading } = useQuery(GET_BOOKABLE_SERVICES, { variables: { adminid }, skip: !adminid });
  const [pick, setPick] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [detailVar, setDetailVar] = useState('');
  const [date, setDate] = useState(istDay(0));
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [book, { loading: booking }] = useMutation(BOOK_APPOINTMENT);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => istDay(i)), []);

  // Services with at least one bookable option; each option is one choice.
  const services = useMemo(() => (((svcData as any)?.getProductServices ?? []) as any[])
    .map((s) => ({ ...s, options: (s.servicevariants || []).filter((v: any) => v?.requiresappointment !== false) }))
    .filter((s) => s.options.length), [svcData]);
  const choices = useMemo(() => services.flatMap((s: any) => s.options.map((v: any) => ({
    key: `${s.id}|${v.id}`, serviceid: s.id, variantid: v.id, name: s.options.length > 1 ? `${s.name} - ${v.name}` : s.name, rate: v.servicerate, mins: minutes(v.duration), v,
  }))), [services]);
  const chosen = choices.find((c: any) => c.key === pick);
  const showDetail = (s: any) => { setDetail(s); setDetailVar(chosen?.serviceid === s.id ? chosen.variantid : s.options[0].id); };
  const dv = detail?.options.find((v: any) => v.id === detailVar) || detail?.options[0];

  const { data: slotData, loading: slotLoading, error: slotError } = useQuery(GET_BOOKING_SLOTS, {
    variables: { adminid, serviceid: chosen?.serviceid, variantid: chosen?.variantid, date },
    skip: !adminid || !chosen,
    fetchPolicy: 'network-only',
  });
  const slots = ((slotData as any)?.getBookingSlots ?? []) as any[];
  const st = (onData as any)?.getAdminSettings;
  const open = !!(st?.onlineBookingAllowed && st?.bookingOn) && appointmentsOn;

  const confirm = async () => {
    if (!chosen || !time) return;
    setError('');
    try {
      await book({ variables: { input: { serviceid: chosen.serviceid, variantid: chosen.variantid, date, starttime: time, notes: notes.trim() || undefined } } });
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Could not book. Please try another time.');
    }
  };

  const chip = (active: boolean) => [styles.chip, { borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand : colors.cardGlass }];
  const chipText = (active: boolean) => [styles.chipText, { color: active ? '#fff' : colors.text }];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label="Book Appointment" />
      <ScrollView contentContainerStyle={styles.body}>
        {!open && onData ? (
          <Text style={[styles.note, { color: colors.subText }]}>Online booking is not open right now. Please call us to book.</Text>
        ) : done ? (
          <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <Icon name="check-circle-outline" size={28} color="#22c55e" />
            <Text style={[styles.title, { color: colors.text }]}>Booking received</Text>
            <Text style={[styles.note, { color: colors.subText }]}>{chosen?.name} on {dayLabel(date)} at {time12(time)}. We will confirm it shortly.</Text>
            <Pressable onPress={() => navigation.navigate('MyBookings')}>
              <Text style={[styles.title, { color: colors.brand }]}>View my bookings</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>1. Choose a service</Text>
            {svcLoading ? <ActivityIndicator color={colors.brand} /> : services.length ? services.map((s: any) => {
              const img = photosOf(s)[0];
              const v0 = s.options[0];
              const picked = chosen?.serviceid === s.id;
              const from = Math.min(...s.options.map((v: any) => Number(v.servicerate) || 0));
              return (
                <Pressable key={s.id} onPress={() => showDetail(s)}
                  style={[styles.svc, { backgroundColor: colors.cardGlass, borderColor: picked ? colors.brand : colors.border }]}>
                  <View style={styles.svcText}>
                    <Text style={[styles.svcName, { color: colors.text }]}>{s.name}</Text>
                    <Text style={[styles.note, { color: colors.text }]}>{s.options.length > 1 ? 'From ' : ''}{rupees(from)}{s.options.length === 1 && PER[v0.pricingunit] ? ` ${PER[v0.pricingunit]}` : ''} · {mins(minutes(v0.duration))}</Text>
                    {!!s.description && <Text numberOfLines={2} style={[styles.sub, { color: colors.subText }]}>{s.description}</Text>}
                    <Text style={[styles.link, { color: colors.brand }]}>{picked ? `Selected${s.options.length > 1 ? `: ${chosen?.v?.name}` : ''}` : 'View details'}</Text>
                  </View>
                  {img ? <Image source={{ uri: img }} style={styles.svcImg} />
                    : <View style={[styles.svcImg, styles.svcEmpty, { backgroundColor: colors.raisedSurface }]}><Icon name="star-four-points-outline" size={24} color={colors.brand} /></View>}
                </Pressable>
              );
            }) : <Text style={[styles.note, { color: colors.subText }]}>No services are open for booking.</Text>}

            {chosen && (
              <>
                <Text style={[styles.title, { color: colors.text }]}>2. Pick a day</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                  {days.map((d) => (
                    <Pressable key={d} onPress={() => { setDate(d); setTime(''); }} style={chip(date === d)}>
                      <Text style={chipText(date === d)}>{dayLabel(d)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[styles.title, { color: colors.text }]}>3. Pick a time</Text>
                {slotLoading ? <ActivityIndicator color={colors.brand} />
                  : slotError ? <Text style={styles.error}>{slotError.message}</Text>
                  : slots.length ? (
                    <View style={styles.wrap}>
                      {slots.map((s) => (
                        <Pressable key={s.starttime} onPress={() => setTime(s.starttime)} style={chip(time === s.starttime)}>
                          <Text style={chipText(time === s.starttime)}>{time12(s.starttime)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : <Text style={[styles.note, { color: colors.subText }]}>No free time on this day. Try another day.</Text>}
              </>
            )}

            {chosen && time ? (
              <>
                <TextInput value={notes} onChangeText={setNotes} placeholder="Anything we should know? (optional)" placeholderTextColor={colors.subText}
                  multiline style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.raisedSurface }]} />
                <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border, alignItems: 'stretch' }]}>
                  <View style={styles.line}><Text style={[styles.note, { color: colors.subText, flex: 1 }]}>{chosen.name}</Text><Text style={[styles.note, { color: colors.text }]}>{rupees(chosen.rate)}</Text></View>
                  {Number(chosen.v.visitcharge) > 0 && <View style={styles.line}><Text style={[styles.note, { color: colors.subText }]}>Visit charge</Text><Text style={[styles.note, { color: colors.text }]}>{rupees(chosen.v.visitcharge)}</Text></View>}
                  <View style={styles.line}><Text style={[styles.title, { color: colors.text }]}>Total</Text><Text style={[styles.title, { color: colors.text }]}>{rupees((Number(chosen.rate) || 0) + (Number(chosen.v.visitcharge) || 0))}</Text></View>
                  <Text style={[styles.sub, { color: colors.subText }]}>{chosen.v.taxinclusive ? 'Includes taxes.' : 'Taxes extra as applicable.'} Pay after the service.</Text>
                </View>
                {!!error && <Text style={styles.error}>{error}</Text>}
                <Pressable onPress={confirm} disabled={booking} style={[styles.button, { backgroundColor: colors.brand, opacity: booking ? 0.6 : 1 }]}>
                  <Text style={styles.buttonText}>{booking ? 'Booking...' : `Book ${time12(time)}, ${dayLabel(date)}`}</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)} />
        {detail && dv && (
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <View style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.svcName, { color: colors.text }]}>{detail.name}</Text>
                {!!detail.categoryid?.categoryname && <Text style={[styles.sub, { color: colors.subText }]}>{detail.categoryid.categoryname}</Text>}
              </View>
              <Pressable onPress={() => setDetail(null)} hitSlop={10}><Icon name="close" size={22} color={colors.text} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {photosOf(detail).length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                  {photosOf(detail).map((u) => <Image key={u} source={{ uri: u }} style={styles.photo} />)}
                </ScrollView>
              )}
              {!!detail.description && <Text style={[styles.note, { color: colors.text, lineHeight: 20 }]}>{detail.description}</Text>}
              <Text style={[styles.title, { color: colors.text }]}>{detail.options.length > 1 ? 'Choose an option' : 'Price and time'}</Text>
              {detail.options.map((v: any) => (
                <Pressable key={v.id} onPress={() => setDetailVar(v.id)}
                  style={[styles.opt, { borderColor: dv.id === v.id ? colors.brand : colors.border, backgroundColor: colors.cardGlass }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.chipText, { color: colors.text }]}>{detail.options.length > 1 ? v.name : detail.name}</Text>
                    <Text style={[styles.sub, { color: colors.subText }]}>{mins(minutes(v.duration))}</Text>
                  </View>
                  <Text style={[styles.chipText, { color: colors.text }]}>{rupees(v.servicerate)}{PER[v.pricingunit] ? ` ${PER[v.pricingunit]}` : ''}</Text>
                </Pressable>
              ))}
              {facts(dv).length > 0 && (
                <View style={styles.wrap}>
                  {facts(dv).map((f) => (
                    <View key={f.text} style={[styles.fact, { backgroundColor: colors.raisedSurface }]}>
                      <Icon name={f.icon} size={14} color={colors.text} /><Text style={[styles.sub, { color: colors.text, marginTop: 0 }]}>{f.text}</Text>
                    </View>
                  ))}
                </View>
              )}
              {(dv.checklist || []).length > 0 && (
                <>
                  <Text style={[styles.title, { color: colors.text }]}>What's included</Text>
                  {dv.checklist.map((c: string) => (
                    <View key={c} style={styles.check}><Icon name="check" size={16} color="#16a34a" /><Text style={[styles.note, { color: colors.text, flex: 1 }]}>{c}</Text></View>
                  ))}
                </>
              )}
              {!!dv.remarks && <Text style={[styles.remark]}>Please note: {dv.remarks}</Text>}
            </ScrollView>
            <Pressable onPress={() => { setPick(`${detail.id}|${dv.id}`); setTime(''); setDetail(null); }} style={[styles.button, { backgroundColor: colors.brand }]}>
              <Text style={styles.buttonText}>Select · {rupees(dv.servicerate)}{PER[dv.pricingunit] ? ` ${PER[dv.pricingunit]}` : ''}</Text>
            </Pressable>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontSize: 14, fontFamily: FONTS.semiBold, marginTop: 6 },
  note: { fontSize: 13, fontFamily: FONTS.regular },
  sub: { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: FONTS.semiBold },
  card: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 6, alignItems: 'flex-start' },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 60, fontSize: 13, textAlignVertical: 'top' },
  error: { color: '#ef4444', fontSize: 13 },
  button: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 14, fontFamily: FONTS.semiBold },
  svc: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  svcText: { flex: 1, gap: 3 },
  svcName: { fontSize: 15, fontFamily: FONTS.semiBold },
  svcImg: { width: 84, height: 84, borderRadius: 10 },
  svcEmpty: { alignItems: 'center', justifyContent: 'center' },
  link: { fontSize: 12, fontFamily: FONTS.semiBold, marginTop: 2 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 10 },
  sheetBody: { gap: 10, paddingBottom: 8 },
  photo: { width: 240, height: 160, borderRadius: 12 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  check: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  remark: { backgroundColor: '#fffbeb', color: '#92400e', borderRadius: 10, padding: 10, fontSize: 13 },
});
