import React from 'react';
import {
  View, Text, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { GET_SALES_ORDERS } from '../../../../apollo/queries/party';
import { formatINR, formatDate } from '../../../../utils';
import { BackHeader } from '../../../../components';
import type { RootState } from '../../../../store/rootreducer';

const STATUS_COLOR: Record<string, string> = {
  Confirmed: '#3b82f6',
  Pending:   '#f59e0b',
  Cancelled: '#ef4444',
};

const TIMELINE: Record<string, { steps: string[]; current: number }> = {
  Confirmed: { steps: ['Order Placed', 'Confirmed', 'Dispatched', 'Delivered'], current: 1 },
  Pending:   { steps: ['Order Placed', 'Confirmed', 'Dispatched', 'Delivered'], current: 0 },
  Cancelled: { steps: ['Order Placed', 'Cancelled'], current: 1 },
};

const DUMMY_ORDER = {
  id: 'dummy',
  billnumber: 'SO/2024/001',
  billdate:   '2024-11-15T00:00:00.000Z',
  totalamount: 4788,
  subtotal:    4560,
  totalgst:    228,
  totaldiscount: 0,
  status: true,
  cancelStatus: null,
  salesmenid: { id: 's1', name: 'Rahul Sharma' },
  partyacc:   { id: 'p1', accountname: 'Mahesh Traders', mobile: '9876543210' },
  productservice: [
    { productserviceid: { id: 'p1', name: 'Premium Basmati Rice' },  variantid: { id: 'v1', name: '5 kg'  }, qty: 3, rate: 560, gst: 5, amount: 1680 },
    { productserviceid: { id: 'p2', name: 'Toor Dal' },              variantid: { id: 'v2', name: '2 kg'  }, qty: 4, rate: 185, gst: 5, amount: 740  },
    { productserviceid: { id: 'p3', name: 'Refined Sunflower Oil' }, variantid: { id: 'v3', name: '1 L'   }, qty: 6, rate: 170, gst: 5, amount: 1020 },
    { productserviceid: { id: 'p4', name: 'Whole Wheat Atta' },      variantid: { id: 'v4', name: '5 kg'  }, qty: 4, rate: 275, gst: 0, amount: 1100 },
  ],
};

function getStatus(order: any): string {
  if (order.cancelStatus === 'cancelled') return 'Cancelled';
  if (order.status) return 'Confirmed';
  return 'Pending';
}

function OrderTimeline({ status }: { status: string }) {
  const { colors } = useTheme();
  const config = TIMELINE[status] ?? TIMELINE.Pending;
  const colour = STATUS_COLOR[status] ?? colors.brand;

  return (
    <View style={styles.timeline}>
      {config.steps.map((step, i) => {
        const done    = i <= config.current;
        const current = i === config.current;
        return (
          <View key={step} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={[styles.timelineDot, {
                backgroundColor: done ? colour : colors.border,
                borderColor:     done ? colour : colors.border,
              }]}>
                {done && <Icon name="check" size={10} color="#fff" />}
              </View>
              {i < config.steps.length - 1 && (
                <View style={[styles.timelineLine, { backgroundColor: i < config.current ? colour : colors.border }]} />
              )}
            </View>
            <Text style={[styles.timelineLabel, {
              color:      current ? colour : done ? colors.text : colors.subText,
              fontFamily: current ? FONTS.bold : FONTS.regular,
            }]}>
              {step}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function OrderDetail() {
  const route   = useRoute<any>();
  const orderId = route.params?.orderId;

  const { colors, isDark } = useTheme();
  const user    = useSelector((s: RootState) => s.auth.user);
  const tenant  = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const { data, loading } = useQuery(GET_SALES_ORDERS, {
    variables: { adminid, partyaccid: user?.id },
    skip: !adminid || !user?.id,
  });

  const allOrders  = (data?.getSalesOrders ?? []) as any[];
  const fetched    = allOrders.find((o: any) => o.id === orderId);
  const order      = fetched ?? DUMMY_ORDER;
  const status     = getStatus(order);
  const colour     = STATUS_COLOR[status] ?? colors.brand;

  const items      = order.productservice ?? [];
  const subtotal   = order.subtotal    ?? items.reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
  const gstAmt     = order.totalgst    ?? 0;
  const discount   = order.totaldiscount ?? 0;
  const grand      = order.totalamount ?? (subtotal + gstAmt - discount);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label={`Order ${order.billnumber ?? ''}`} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Order header */}
        <Animated.View entering={FadeInUp.duration(400).delay(40)}
          style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          <View style={styles.orderHeaderTop}>
            <View>
              <Text style={[styles.orderNum, { color: colors.text }]}>{order.billnumber ?? '–'}</Text>
              <View style={styles.dateRow}>
                <Icon name="calendar-outline" size={12} color={colors.subText} />
                <Text style={[styles.orderDate, { color: colors.subText }]}>{formatDate(order.billdate)}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: colour + '22' }]}>
              <View style={[styles.statusDot, { backgroundColor: colour }]} />
              <Text style={[styles.statusText, { color: colour }]}>{status}</Text>
            </View>
          </View>
          {order.salesmenid?.name && (
            <View style={styles.salesmanRow}>
              <Icon name="account-tie-outline" size={14} color={colors.subText} />
              <Text style={[styles.salesmanText, { color: colors.subText }]}>
                Salesman: {order.salesmenid.name}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Timeline */}
        <Animated.View entering={FadeInUp.duration(400).delay(80)}
          style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Order Status</Text>
          <OrderTimeline status={status} />
        </Animated.View>

        {/* Items */}
        <Animated.View entering={FadeInUp.duration(400).delay(120)}
          style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Items ({items.length})
          </Text>
          {items.map((item: any, idx: number) => (
            <View key={item.productserviceid?.id ?? idx} style={[
              styles.itemRow,
              idx < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}>
              <View style={[styles.itemIcon, { backgroundColor: colors.brandSoft }]}>
                <Icon name="package-variant-closed" size={16} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                  {item.productserviceid?.name ?? 'Product'}
                </Text>
                <Text style={[styles.itemVariant, { color: colors.subText }]}>
                  {item.variantid?.name ?? ''} × {item.qty} @ {formatINR(item.rate)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.itemAmount, { color: colors.text }]}>{formatINR(item.amount)}</Text>
                {(item.gst ?? 0) > 0 && (
                  <Text style={[styles.itemGst, { color: colors.subText }]}>GST {item.gst}%</Text>
                )}
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Price breakdown */}
        <Animated.View entering={FadeInUp.duration(400).delay(160)}
          style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>Price Details</Text>

          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: colors.subText }]}>Subtotal</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>{formatINR(subtotal)}</Text>
          </View>
          {gstAmt > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.subText }]}>GST</Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>{formatINR(gstAmt)}</Text>
            </View>
          )}
          {discount > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: '#22c55e' }]}>Discount</Text>
              <Text style={[styles.priceValue, { color: '#22c55e' }]}>− {formatINR(discount)}</Text>
            </View>
          )}
          <View style={[styles.priceRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>Total Payable</Text>
            <Text style={[styles.totalValue, { color: colors.brand }]}>{formatINR(grand)}</Text>
          </View>
        </Animated.View>

        {/* Party info */}
        {order.partyacc && (
          <Animated.View entering={FadeInUp.duration(400).delay(200)}
            style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>Account</Text>
            <View style={styles.infoRow}>
              <Icon name="store-outline" size={14} color={colors.subText} />
              <Text style={[styles.infoText, { color: colors.text }]}>{order.partyacc.accountname}</Text>
            </View>
            {order.partyacc.mobile && (
              <View style={styles.infoRow}>
                <Icon name="phone-outline" size={14} color={colors.subText} />
                <Text style={[styles.infoText, { color: colors.text }]}>+91 {order.partyacc.mobile}</Text>
              </View>
            )}
          </Animated.View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 40 },

  card: {
    borderRadius: 20, borderWidth: 1, padding: 16, marginTop: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 14 },

  orderHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderNum:  { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 4 },
  dateRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderDate: { fontSize: 12, fontFamily: FONTS.regular },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusText:  { fontSize: 12, fontFamily: FONTS.bold },
  salesmanRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  salesmanText:{ fontSize: 12, fontFamily: FONTS.regular },

  timeline:      { paddingLeft: 4 },
  timelineItem:  { flexDirection: 'row', alignItems: 'flex-start', minHeight: 40 },
  timelineLeft:  { alignItems: 'center', marginRight: 14, width: 20 },
  timelineDot:   { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  timelineLine:  { width: 2, flex: 1, minHeight: 20, marginTop: 2 },
  timelineLabel: { fontSize: 13, paddingTop: 2, paddingBottom: 12 },

  itemRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  itemIcon:   { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  itemName:   { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 2 },
  itemVariant:{ fontSize: 11, fontFamily: FONTS.regular },
  itemAmount: { fontSize: 13, fontFamily: FONTS.bold },
  itemGst:    { fontSize: 10, fontFamily: FONTS.regular, marginTop: 2 },

  priceRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  priceLabel: { fontSize: 13, fontFamily: FONTS.regular },
  priceValue: { fontSize: 13, fontFamily: FONTS.semiBold },
  totalRow:   { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 4, marginBottom: 0 },
  totalLabel: { fontSize: 15, fontFamily: FONTS.bold },
  totalValue: { fontSize: 17, fontFamily: FONTS.bold },

  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText: { fontSize: 13, fontFamily: FONTS.semiBold },
});
