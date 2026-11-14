import React, { useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client/react';
import { FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';
import { CANCEL_MY_APPOINTMENT, GET_MY_APPOINTMENTS } from '../../../../apollo/queries/booking';

const STATUS: Record<string, { label: string; color: string }> = {
  booked: { label: 'Booked', color: '#d97706' },
  confirmed: { label: 'Confirmed', color: '#16a34a' },
  arrived: { label: 'Arrived', color: '#0284c7' },
  done: { label: 'Done', color: '#64748b' },
  noshow: { label: 'Missed', color: '#e11d48' },
  cancelled: { label: 'Cancelled', color: '#e11d48' },
};
const nowIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 16).replace('T', ' ');
const time12 = (hhmm: string) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The customer's own bookings; upcoming Booked / Confirmed ones can be cancelled. */
export default function MyBookingsScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const { data, loading, refetch } = useQuery(GET_MY_APPOINTMENTS, { fetchPolicy: 'cache-and-network' });
  const [cancel] = useMutation(CANCEL_MY_APPOINTMENT);
  useFocusEffect(useCallback(() => { refetch?.(); }, [refetch]));

  const now = nowIst();
  const all = ((data as any)?.getMyAppointments ?? []) as any[];
  const upcoming = all.filter((a) => `${a.billdate} ${a.starttime}` > now && !['cancelled', 'done', 'noshow'].includes(a.apptStatus))
    .sort((a, b) => `${a.billdate} ${a.starttime}`.localeCompare(`${b.billdate} ${b.starttime}`));
  const past = all.filter((a) => !upcoming.includes(a));

  const onCancel = (a: any) =>
    Alert.alert('Cancel booking?', `${dayLabel(a.billdate)} at ${time12(a.starttime)}`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: async () => {
        try { await cancel({ variables: { id: a.id } }); await refetch(); }
        catch (e: any) { Alert.alert('Could not cancel', e?.message || 'Please try again.'); }
      } },
    ]);

  const card = (a: any, canCancel: boolean) => {
    const st = STATUS[a.apptStatus] || STATUS.booked;
    return (
      <View key={a.id} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={styles.line}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{a.service || 'Service'}</Text>
          <Text style={[styles.badge, { color: st.color, borderColor: st.color }]}>{st.label}</Text>
        </View>
        <Text style={[styles.sub, { color: colors.subText }]}>
          {dayLabel(a.billdate)} · {time12(a.starttime)}{a.duration ? ` · ${a.duration} min` : ''}{a.staff ? ` · ${a.staff}` : ''}
        </Text>
        {a.amount ? <Text style={[styles.sub, { color: colors.text }]}>₹{Number(a.amount).toLocaleString('en-IN')}</Text> : null}
        {canCancel && ['booked', 'confirmed'].includes(a.apptStatus) && (
          <Pressable onPress={() => onCancel(a)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <BackHeader label="My Bookings" />
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable onPress={() => navigation.navigate('Booking')} style={[styles.book, { backgroundColor: colors.brand }]}>
          <Icon name="calendar-plus" size={16} color="#fff" />
          <Text style={styles.bookText}>New Booking</Text>
        </Pressable>
        {loading && !all.length ? <ActivityIndicator color={colors.brand} /> : !all.length ? (
          <Text style={[styles.sub, { color: colors.subText }]}>You have no bookings yet.</Text>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Upcoming</Text>
            {upcoming.length ? upcoming.map((a) => card(a, true)) : <Text style={[styles.sub, { color: colors.subText }]}>No upcoming bookings.</Text>}
            {past.length > 0 && <Text style={[styles.title, { color: colors.text }]}>Past and Cancelled</Text>}
            {past.map((a) => card(a, false))}
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
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontFamily: FONTS.semiBold },
  badge: { fontSize: 11, fontFamily: FONTS.semiBold, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  sub: { fontSize: 12, fontFamily: FONTS.regular },
  cancel: { alignSelf: 'flex-start', marginTop: 4, borderWidth: 1, borderColor: '#fecdd3', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  cancelText: { color: '#e11d48', fontSize: 12, fontFamily: FONTS.semiBold },
  book: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10 },
  bookText: { color: '#fff', fontSize: 14, fontFamily: FONTS.semiBold },
});
