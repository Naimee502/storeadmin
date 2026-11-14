import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useDispatch } from 'react-redux';
import { FONTS, useTheme } from '../../../config';
import { AppHeader, AppModal } from '../../../components';
import { useAuth } from '../../../navigation/authcontext';
import { safeLogout } from '../../../utils/safelogout';
import { GET_SUPPLIER_PORTAL } from '../../../apollo/queries/supplier';

const rupees = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dateLabel = (ymd?: string | null) =>
  ymd ? new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-';
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const ORDER_COLOR: Record<string, string> = { pending: '#d97706', confirmed: '#0284c7', received: '#16a34a', cancelled: '#e11d48', returned: '#64748b' };

/** One query feeds every supplier tab; refreshed when a tab comes into view. */
const usePortal = () => {
  const q = useQuery(GET_SUPPLIER_PORTAL, { fetchPolicy: 'cache-and-network' });
  useFocusEffect(useCallback(() => { q.refetch?.().catch(() => {}); }, [q.refetch])); // eslint-disable-line react-hooks/exhaustive-deps
  return { p: (q.data as any)?.getSupplierPortal, loading: q.loading, error: q.error, refetch: q.refetch };
};

function Shell({ title, children }: { title: string; children: (p: any) => React.ReactNode }) {
  const { colors, isDark } = useTheme();
  const { p, loading, error, refetch } = usePortal();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <AppHeader label={title} />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch?.()} />}>
        {!p && loading ? <ActivityIndicator color={colors.brand} />
          : !p ? <Text style={[styles.sub, { color: '#e11d48' }]}>{error?.message || 'Could not load your account.'}</Text>
          : children(p)}
      </ScrollView>
    </View>
  );
}

function Row({ title, sub, amount, badge, color, onPress }: { title: string; sub: string; amount: string; badge?: string; color?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
      <View style={styles.line}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.name, { color: colors.text }]}>{amount}</Text>
      </View>
      <View style={styles.line}>
        <Text style={[styles.sub, { color: colors.subText, flex: 1 }]} numberOfLines={1}>{sub}</Text>
        {!!badge && <Text style={[styles.badge, { color: color || colors.subText, borderColor: color || colors.border }]}>{badge}</Text>}
      </View>
    </Pressable>
  );
}

const billBadge = (b: any) => (b.outstanding <= 0 ? ['Paid', '#16a34a'] : b.outstanding < b.totalamount ? ['Part Paid', '#d97706'] : ['Unpaid', '#e11d48']);
const billRow = (nav: any) => (b: any) => {
  const [badge, color] = billBadge(b);
  return <Row key={b.id} title={b.billnumber ? `INV-${b.billnumber}` : 'Bill'} sub={`${dateLabel(b.billdate)} · Unpaid ${rupees(b.outstanding)}`} amount={rupees(b.totalamount)} badge={badge} color={color}
    onPress={() => nav.navigate('SupplierDocument', { kind: 'bill', id: b.id })} />;
};
const empty = (t: string, color: string) => <Text style={[styles.sub, { color, textAlign: 'center', marginTop: 20 }]}>{t}</Text>;

export function SupplierHome() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <Shell title="Home">
      {(p) => {
        const open = p.bills.filter((b: any) => b.outstanding > 0);
        const cards = [
          { label: p.payable >= 0 ? 'Payable to you' : 'You owe us', value: rupees(Math.abs(p.payable)), color: p.payable >= 0 ? '#16a34a' : '#e11d48', to: 'SupplierPayments', icon: 'cash-multiple' },
          { label: 'Unpaid bills', value: `${open.length} · ${rupees(open.reduce((t: number, b: any) => t + b.outstanding, 0))}`, color: colors.text, to: 'SupplierBills', icon: 'file-document-outline' },
          { label: 'Open orders', value: String(p.orders.filter((o: any) => ['pending', 'confirmed'].includes(o.orderStatus)).length), color: colors.text, to: 'SupplierOrders', icon: 'clipboard-list-outline' },
        ];
        return (
          <>
            <Text style={[styles.hello, { color: colors.text }]}>Hello, {p.name}</Text>
            {!!p.company && <Text style={[styles.sub, { color: colors.subText }]}>Your account with {p.company}</Text>}
            {cards.map((c) => (
              <Pressable key={c.label} onPress={() => navigation.navigate(c.to)} style={[styles.stat, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                <Icon name={c.icon} size={22} color={colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sub, { color: colors.subText }]}>{c.label}</Text>
                  <Text style={[styles.value, { color: c.color }]}>{c.value}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.subText} />
              </Pressable>
            ))}
            <Text style={[styles.title, { color: colors.text }]}>Unpaid bills</Text>
            {open.length ? open.slice(0, 5).map(billRow(navigation)) : empty('All bills are paid.', colors.subText)}
          </>
        );
      }}
    </Shell>
  );
}

export function SupplierBills() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  return <Shell title="Bills">{(p) => (p.bills.length ? p.bills.map(billRow(navigation)) : empty('No bills yet.', colors.subText))}</Shell>;
}

export function SupplierOrders() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  return (
    <Shell title="Purchase Orders">
      {(p) => (p.orders.length ? p.orders.map((o: any) => (
        <Row key={o.id} title={o.billnumber ? `PO-${o.billnumber}` : 'Order'} sub={`${dateLabel(o.billdate)} · ${o.items} item${o.items === 1 ? '' : 's'}`}
          amount={rupees(o.totalamount)} badge={cap(o.orderStatus)} color={ORDER_COLOR[o.orderStatus]}
          onPress={() => navigation.navigate('SupplierDocument', { kind: 'order', id: o.id })} />
      )) : empty('No purchase orders yet.', colors.subText))}
    </Shell>
  );
}

export function SupplierPayments() {
  const { colors } = useTheme();
  return (
    <Shell title="Payments">
      {(p) => (p.payments.length ? p.payments.map((x: any) => (
        <Row key={x.id} title={x.paymentcode || 'Payment'}
          sub={`${dateLabel(x.paymentdate)}${x.mode ? ` · ${cap(String(x.mode))}` : ''}${x.reference ? ` · ${x.reference}` : ''}`}
          amount={rupees(x.amount)} badge={x.type === 'payment' ? 'Paid to you' : x.type === 'receipt' ? 'Received from you' : 'Refund'}
          color={x.type === 'payment' ? '#16a34a' : '#64748b'} />
      )) : empty('No payments yet.', colors.subText))}
    </Shell>
  );
}

export function SupplierProfile() {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const { signOut } = useAuth();
  const [confirm, setConfirm] = useState(false);
  return (
    <Shell title="Profile">
      {(p) => (
        <>
          <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border, alignItems: 'center', gap: 6 }]}>
            <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
              <Text style={styles.avatarText}>{String(p.name || 'S').split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</Text>
            </View>
            <Text style={[styles.hello, { color: colors.text }]}>{p.name}</Text>
            {!!p.mobile && <Text style={[styles.sub, { color: colors.subText }]}>+91 {p.mobile}</Text>}
            <Text style={[styles.sub, { color: colors.subText }]}>Supplier{p.company ? ` · ${p.company}` : ''}</Text>
          </View>
          <Pressable onPress={() => setConfirm(true)} style={[styles.logout, { borderColor: '#fecdd3' }]}>
            <Icon name="logout" size={18} color="#e11d48" />
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
          <AppModal visible={confirm} title="Logout" message="Do you want to logout?" confirmLabel="Logout" cancelLabel="Cancel"
            confirmColor={colors.error} iconName="logout-variant"
            onConfirm={() => { setConfirm(false); safeLogout(dispatch, signOut); }} onClose={() => setConfirm(false)} />
        </>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { padding: 16, gap: 10, paddingBottom: 110 },
  hello: { fontSize: 18, fontFamily: FONTS.bold },
  title: { fontSize: 14, fontFamily: FONTS.semiBold, marginTop: 6 },
  sub: { fontSize: 12, fontFamily: FONTS.regular },
  value: { fontSize: 18, fontFamily: FONTS.bold },
  name: { fontSize: 14, fontFamily: FONTS.semiBold },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { fontSize: 11, fontFamily: FONTS.semiBold, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontFamily: FONTS.bold },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  logoutText: { color: '#e11d48', fontSize: 14, fontFamily: FONTS.semiBold },
});

export { default as SupplierDocument } from './document';
