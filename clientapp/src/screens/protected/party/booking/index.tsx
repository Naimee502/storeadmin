import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMutation, useQuery } from '@apollo/client/react';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';
import { BOOK_APPOINTMENT, GET_BOOKABLE_SERVICES, GET_BOOKING_ON, GET_BOOKING_SLOTS } from '../../../../apollo/queries/booking';
import type { RootState } from '../../../../store/rootreducer';

const istDay = (offset: number) => new Date(Date.now() + 330 * 60000 + offset * 86400000).toISOString().slice(0, 10);
const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const minutes = (d?: { amount?: number; unit?: string }) => Math.round((Number(d?.amount) || 0.5) * (d?.unit === 'minutes' ? 1 : 60));

/** Party books a service slot: service, day, free time, confirm. */
export default function BookingScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const adminid = useSelector((s: RootState) => (s as any).tenant?.adminId ?? '');
  const { data: onData } = useQuery(GET_BOOKING_ON, { variables: { adminid }, skip: !adminid });
  const { data: svcData, loading: svcLoading } = useQuery(GET_BOOKABLE_SERVICES, { variables: { adminid }, skip: !adminid });
  const [pick, setPick] = useState('');
  const [date, setDate] = useState(istDay(0));
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [book, { loading: booking }] = useMutation(BOOK_APPOINTMENT);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => istDay(i)), []);

  const choices = useMemo(() => {
    const out: any[] = [];
    for (const s of ((svcData as any)?.getProductServices ?? []) as any[]) {
      for (const v of s.servicevariants || []) {
        if (v?.requiresappointment === false) continue;
        out.push({ key: `${s.id}|${v.id}`, serviceid: s.id, variantid: v.id, name: s.servicevariants.length > 1 ? `${s.name} - ${v.name}` : s.name, rate: v.servicerate, mins: minutes(v.duration) });
      }
    }
    return out;
  }, [svcData]);
  const chosen = choices.find((c) => c.key === pick);

  const { data: slotData, loading: slotLoading, error: slotError } = useQuery(GET_BOOKING_SLOTS, {
    variables: { adminid, serviceid: chosen?.serviceid, variantid: chosen?.variantid, date },
    skip: !adminid || !chosen,
    fetchPolicy: 'network-only',
  });
  const slots = ((slotData as any)?.getBookingSlots ?? []) as any[];
  const st = (onData as any)?.getAdminSettings;
  const open = !!(st?.onlineBookingAllowed && st?.bookingOn);

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
            {svcLoading ? <ActivityIndicator color={colors.brand} /> : choices.length ? (
              <View style={styles.wrap}>
                {choices.map((c) => (
                  <Pressable key={c.key} onPress={() => { setPick(c.key); setTime(''); }} style={chip(pick === c.key)}>
                    <Text style={chipText(pick === c.key)}>{c.name}</Text>
                    <Text style={[styles.sub, { color: pick === c.key ? '#fff' : colors.subText }]}>{c.mins} min{c.rate ? ` · ₹${Number(c.rate).toLocaleString('en-IN')}` : ''}</Text>
                  </Pressable>
                ))}
              </View>
            ) : <Text style={[styles.note, { color: colors.subText }]}>No services are open for booking.</Text>}

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
                {!!error && <Text style={styles.error}>{error}</Text>}
                <Pressable onPress={confirm} disabled={booking} style={[styles.button, { backgroundColor: colors.brand, opacity: booking ? 0.6 : 1 }]}>
                  <Text style={styles.buttonText}>{booking ? 'Booking...' : `Book ${time12(time)}, ${dayLabel(date)}`}</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
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
});
