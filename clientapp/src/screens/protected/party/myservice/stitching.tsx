import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useTheme } from '../../../../config';
import { GET_MY_TAILOR_ORDER, GET_MY_TAILOR_ORDERS } from '../../../../apollo/queries/myservice';
import { Card, Pill, Screen, dateLabel, rupees, s } from './shared';

const STEPS = ['received', 'cutting', 'stitching', 'trial', 'ready', 'delivered'];
const STATUS: Record<string, [string, string]> = {
  received: ['Received', '#64748b'], cutting: ['Cutting', '#0284c7'], stitching: ['Stitching', '#4f46e5'], trial: ['Ready for Trial', '#d97706'],
  ready: ['Ready to Collect', '#16a34a'], delivered: ['Delivered', '#16a34a'], cancelled: ['Cancelled', '#e11d48'],
};
const garments = (o: any) => (o.items || []).map((i: any) => `${i.qty} ${i.garment}`).join(', ');

/** Customer's stitching orders. */
export function MyStitching() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { data, loading, error, refetch } = useQuery(GET_MY_TAILOR_ORDERS, { fetchPolicy: 'cache-and-network' });
  useFocusEffect(useCallback(() => { refetch?.().catch(() => {}); }, [refetch]));
  const rows = ((data as any)?.getMyTailorOrders ?? []) as any[];
  return (
    <Screen title="My Stitching" loading={loading && !rows.length} error={!rows.length ? error?.message : null}
      empty={!loading && !rows.length ? 'No stitching orders yet.' : null} onRefresh={() => refetch()}>
      {rows.map((o) => {
        const [label, color] = STATUS[o.orderStatus] || STATUS.received;
        return (
          <Card key={o.id} onPress={() => navigation.navigate('MyStitchingOrder', { id: o.id })}>
            <View style={s.row}>
              <Icon name="content-cut" size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { color: colors.text }]}>TO-{o.billnumber} · {garments(o)}</Text>
                <Text style={[s.sub, { color: colors.subText }]}>Ordered {dateLabel(o.billdate)}{o.deliverydate ? ` · Delivery ${dateLabel(o.deliverydate)}` : ''}</Text>
              </View>
              <Pill label={label} color={color} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

/** One stitching order with progress, garments and payment. */
export function MyStitchingOrder() {
  const { colors } = useTheme();
  const id = (useRoute<any>().params?.id ?? '') as string;
  const { data, loading, error, refetch } = useQuery(GET_MY_TAILOR_ORDER, { variables: { id }, skip: !id, fetchPolicy: 'cache-and-network' });
  const o = (data as any)?.getMyTailorOrder;
  const at = o ? (o.orderStatus === 'cancelled' ? -1 : STEPS.indexOf(o.orderStatus)) : -1;
  const [label, color] = (o && STATUS[o.orderStatus]) || STATUS.received;
  return (
    <Screen title={o ? `TO-${o.billnumber}` : 'Stitching Order'} loading={loading && !o} error={!o ? error?.message : null} onRefresh={() => refetch()}>
      {o && (
        <>
          <Card>
            <View style={s.row}><Text style={[s.name, { color: colors.text, flex: 1 }]}>{garments(o)}</Text><Pill label={label} color={color} /></View>
            {o.orderStatus !== 'cancelled' && (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {STEPS.map((x, i) => <View key={x} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= at ? colors.brand : colors.border }} />)}
              </View>
            )}
            <Text style={[s.sub, { color: colors.subText }]}>Ordered {dateLabel(o.billdate)}{o.trialdate ? ` · Trial ${dateLabel(o.trialdate)}` : ''}{o.deliverydate ? ` · Delivery ${dateLabel(o.deliverydate)}` : ''}</Text>
          </Card>
          <Card>
            {o.items.map((i: any, n: number) => (
              <View key={n} style={{ paddingVertical: 6, borderTopWidth: n ? 1 : 0, borderTopColor: colors.border }}>
                <View style={s.row}><Text style={[s.value, { color: colors.text, flex: 1 }]}>{i.qty} × {i.garment}{i.productserviceid?.name ? ` · ${i.productserviceid.name}` : ''}</Text><Text style={[s.value, { color: colors.text }]}>{rupees(i.amount)}</Text></View>
                {!!i.values?.length && <Text style={[s.sub, { color: colors.subText }]}>{i.values.map((v: any) => `${v.label || v.key} ${v.value}`).join(' · ')}{i.unit ? ` (${i.unit})` : ''}</Text>}
                {!!i.design && <Text style={[s.label, { color: colors.subText }]}>Design: {i.design}</Text>}
              </View>
            ))}
            <View style={[s.row, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }]}><Text style={[s.sub, { color: colors.subText }]}>Total</Text><Text style={[s.value, { color: colors.text }]}>{rupees(o.total)}</Text></View>
            {o.advance > 0 && <View style={s.row}><Text style={[s.sub, { color: colors.subText }]}>Advance paid</Text><Text style={[s.value, { color: colors.text }]}>{rupees(o.advance)}</Text></View>}
            {o.advance > 0 && <View style={s.row}><Text style={[s.value, { color: colors.text }]}>Balance</Text><Text style={[s.value, { color: colors.brand }]}>{rupees(Math.max(0, (o.total || 0) - o.advance))}</Text></View>}
          </Card>
        </>
      )}
    </Screen>
  );
}
