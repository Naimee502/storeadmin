import React from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { GET_SALES_ORDER_BY_ID, GET_SALES_INVOICE_BY_ID, GET_ADMIN_SETTINGS } from '../../../../apollo/queries/accounts';
import {
  CONFIRM_SALES_ORDER, CONVERT_SALES_ORDER_TO_INVOICE,
  MARK_SALES_ORDER_DELIVERED, MARK_SALES_INVOICE_DELIVERED,
  MARK_SALES_ORDER_DISPATCHED, MARK_SALES_INVOICE_DISPATCHED,
} from '../../../../apollo/mutations/accounts';
import { usePunchGate } from '../../../../apollo/hooks/attendance';
import { useModuleEnabled } from '../../../../apollo/hooks/admin';
import { formatINR, formatDate, formatBillNumber } from '../../../../utils';
import { BackHeader } from '../../../../components';
import type { RootState } from '../../../../store/rootreducer';

const STATUS_COLOR: Record<string, string> = {
  Confirmed:  '#3b82f6',
  Pending:    '#f59e0b',
  Dispatched: '#0ea5e9',
  Delivered:  '#22c55e',
  Cancelled:  '#ef4444',
};

const TIMELINE: Record<string, { steps: string[]; current: number }> = {
  Pending:    { steps: ['Order Placed', 'Confirmed', 'Dispatched', 'Delivered'], current: 0 },
  Confirmed:  { steps: ['Order Placed', 'Confirmed', 'Dispatched', 'Delivered'], current: 1 },
  Dispatched: { steps: ['Order Placed', 'Confirmed', 'Dispatched', 'Delivered'], current: 2 },
  Delivered:  { steps: ['Order Placed', 'Confirmed', 'Dispatched', 'Delivered'], current: 3 },
  Cancelled:  { steps: ['Order Placed', 'Cancelled'], current: 1 },
};

function getStatus(order: any): string {
  // Prefer the canonical lifecycle field (kept in sync server-side across
  // order + invoice). Fall back to derivation for older records.
  if (order.orderStatus) {
    const s = String(order.orderStatus);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  if (order.cancelStatus === 'cancelled') return 'Cancelled';
  if (order.deliveryStatus === 'delivered') return 'Delivered';
  if (order.deliveryStatus === 'dispatched') return 'Dispatched';
  if (order.isConverted) return 'Confirmed';
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
  const navigation = useNavigation<any>();
  // Supports both a sales order (orderId) and a sales invoice (invoiceId).
  const invoiceId = route.params?.invoiceId;
  const orderId   = route.params?.orderId;
  const isInvoice = !!invoiceId;
  const id        = invoiceId || orderId;
  const { colors, isDark } = useTheme();

  const user = useSelector((s: RootState) => s.auth.user);
  const { data: orderData, loading: orderLoading, refetch: refetchOrder } = useQuery(GET_SALES_ORDER_BY_ID, {
    variables: { id }, skip: !id || isInvoice, fetchPolicy: 'network-only',
  });
  const { data: invData, loading: invLoading, refetch: refetchInv } = useQuery(GET_SALES_INVOICE_BY_ID, {
    variables: { id }, skip: !id || !isInvoice, fetchPolicy: 'network-only',
  });
  const loading = isInvoice ? invLoading : orderLoading;
  const refetch = isInvoice ? refetchInv : refetchOrder;

  // Re-fetch whenever the screen regains focus (e.g. coming back from Edit Order)
  // so edits / status changes reflect immediately.
  useFocusEffect(
    React.useCallback(() => {
      refetch?.();
    }, [refetch])
  );

  const { blocked: punchBlocked } = usePunchGate();
  const salesInvoiceEnabled = useModuleEnabled('salesinvoice');
  const [confirmOrder]          = useMutation(CONFIRM_SALES_ORDER);
  const [convertOrder]          = useMutation(CONVERT_SALES_ORDER_TO_INVOICE);
  const [markOrderDelivered]    = useMutation(MARK_SALES_ORDER_DELIVERED);
  const [markInvoiceDelivered]  = useMutation(MARK_SALES_INVOICE_DELIVERED);
  const [markOrderDispatched]   = useMutation(MARK_SALES_ORDER_DISPATCHED);
  const [markInvoiceDispatched] = useMutation(MARK_SALES_INVOICE_DISPATCHED);
  const [marking, setMarking]   = React.useState(false);

  // An invoice is always at least "Confirmed"; flag it so the timeline is right.
  const order = isInvoice
    ? ((invData as any)?.getSalesInvoiceById ? { ...(invData as any).getSalesInvoiceById, isConverted: true } : null)
    : (orderData as any)?.getSalesOrderById;
  const status   = order ? getStatus(order) : 'Pending';

  // Business fulfilment mode: 'deliveryboy' → delivery boy delivers; else salesman.
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const { data: settingsData } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid: adminId }, skip: !adminId, fetchPolicy: 'cache-and-network',
  });
  const deliveryByBoy = (settingsData as any)?.getAdminSettings?.deliveryMode === 'deliveryboy';
  const manageDownline = (settingsData as any)?.getAdminSettings?.partyManagesDownline === true;

  // Who may move fulfilment forward:
  //  - delivery boy : always (they only ever get the orders meant for them)
  //  - salesman     : always — a salesman ALWAYS fulfils the orders he booked,
  //                   so even in delivery-boy mode his own orders stay with him
  //  - staff/admin  : only when the business is NOT using delivery boys
  //                   (otherwise those orders go to the delivery boy)
  //  - party        : never
  const role = user?.role;
  // A channel party can manage the status of its DOWNLINE orders (sub-party
  // orders) when downline management is on — but never its own orders.
  const isDownlineOrder = !!order && order?.partyacc?.id && order.partyacc.id !== user?.id;
  const canAct = !!order && (
    role === 'deliveryboy' ? true :
    role === 'salesman'    ? true :
    role === 'party'       ? (manageDownline && isDownlineOrder) :
    !deliveryByBoy
  );
  // Confirm (Pending → Confirmed) is for the order manager — the salesman who
  // booked it, or the parent party managing a downline order. Not the end
  // party or delivery boy.
  // When invoicing is enabled, "Confirm" is replaced by "Convert to Invoice"
  // (converting auto-confirms). Order-only businesses keep plain "Confirm".
  const canConfirm  = !salesInvoiceEnabled && !!order && !isInvoice && status === 'Pending' && (
    role === 'salesman' ||
    (role === 'party' && manageDownline && isDownlineOrder)
  );
  // Convert order → invoice (one-tap, server builds the invoice). Same managers
  // as Confirm, on an order that isn't an invoice / already converted / cancelled.
  const canConvert  = salesInvoiceEnabled && !!order && !isInvoice && !order.isConverted && status !== 'Cancelled' && (
    role === 'salesman' ||
    (role === 'party' && manageDownline && isDownlineOrder)
  );
  // Edit allowed before invoice conversion.
  //  - salesman: any order they manage
  //  - party: their OWN order, plus downline orders when downline is on
  const isOwnOrder  = !!order && order?.partyacc?.id === user?.id;
  const canEdit     = !!order && !isInvoice && !order.isConverted && status !== 'Cancelled' && (
    role === 'salesman' ||
    (role === 'party' && (isOwnOrder || (manageDownline && isDownlineOrder)))
  );
  const canDispatch = canAct && (status === 'Pending' || status === 'Confirmed');
  const canDeliver  = canAct && status !== 'Delivered' && status !== 'Cancelled';

  const handleConvert = () => {
    if (punchBlocked) { Alert.alert('Punch in required', 'Please punch in from the Attendance tab first.'); return; }
    Alert.alert('Convert to Invoice', 'Create a Sales Invoice from this order?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Convert',
        onPress: async () => {
          setMarking(true);
          try {
            await convertOrder({ variables: { id } });
            refetch?.();
            Alert.alert('Done', 'Invoice created from this order.');
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not convert.');
          } finally {
            setMarking(false);
          }
        },
      },
    ]);
  };

  const handleConfirm = () => {
    if (punchBlocked) { Alert.alert('Punch in required', 'Please punch in from the Attendance tab first.'); return; }
    Alert.alert('Confirm Order', 'Mark this order as confirmed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setMarking(true);
          try {
            await confirmOrder({ variables: { id } });
            refetch?.();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not confirm.');
          } finally {
            setMarking(false);
          }
        },
      },
    ]);
  };

  const handleMarkDispatched = () => {
    if (punchBlocked) { Alert.alert('Punch in required', 'Please punch in from the Attendance tab first.'); return; }
    Alert.alert('Mark Dispatched', 'Mark this as dispatched / out for delivery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Dispatched',
        onPress: async () => {
          setMarking(true);
          try {
            if (isInvoice) await markInvoiceDispatched({ variables: { id } });
            else await markOrderDispatched({ variables: { id } });
            refetch?.();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not update.');
          } finally {
            setMarking(false);
          }
        },
      },
    ]);
  };

  const handleMarkDelivered = () => {
    if (punchBlocked) { Alert.alert('Punch in required', 'Please punch in from the Attendance tab first.'); return; }
    Alert.alert('Mark Delivered', 'Confirm this has been delivered?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Delivered',
        onPress: async () => {
          setMarking(true);
          try {
            const vars = { id, byId: user?.id, byName: user?.name, byType: user?.role || 'staff' };
            if (isInvoice) await markInvoiceDelivered({ variables: vars });
            else await markOrderDelivered({ variables: vars });
            refetch?.();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not update.');
          } finally {
            setMarking(false);
          }
        },
      },
    ]);
  };
  const colour   = STATUS_COLOR[status] ?? colors.brand;
  const billLabel = order ? formatBillNumber(order) : '—';

  const items    = order?.productservice ?? [];
  const subtotal = order?.subtotal    ?? items.reduce((s: number, i: any) => s + (i.amount ?? 0), 0);
  const gstAmt   = order?.totalgst    ?? 0;
  const discount = order?.totaldiscount ?? 0;
  const grand    = order?.totalamount ?? (subtotal + gstAmt - discount);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label={loading ? 'Order Detail' : billLabel} />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : !order ? (
        <View style={styles.center}>
          <Icon name="clipboard-off-outline" size={44} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>Order not found</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Order header */}
          <Animated.View entering={FadeInUp.duration(400).delay(40)}
            style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
          >
            <View style={styles.orderHeaderTop}>
              <View>
                <Text style={[styles.orderNum, { color: colors.text }]}>{billLabel}</Text>
                <View style={styles.dateRow}>
                  <Icon name="calendar-outline" size={12} color={colors.subText} />
                  <Text style={[styles.orderDate, { color: colors.subText }]}>{formatDate(order.billdate)}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={[styles.statusBadge, { backgroundColor: colour + '22' }]}>
                  <View style={[styles.statusDot, { backgroundColor: colour }]} />
                  <Text style={[styles.statusText, { color: colour }]}>{status}</Text>
                </View>
                {Math.max(0, order.outstanding || 0) > 0 && (
                  <Text style={styles.dueText}>Due: {formatINR(Math.max(0, order.outstanding || 0))}</Text>
                )}
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
            <Text style={[styles.cardTitle, { color: colors.text }]}>Items ({items.length})</Text>
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
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.subText }]}>Total Discount</Text>
              <Text style={[styles.priceValue, { color: discount > 0 ? '#22c55e' : colors.subText }]}>
                {discount > 0 ? `− ${formatINR(discount)}` : formatINR(0)}
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: colors.subText }]}>GST</Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>{formatINR(gstAmt)}</Text>
            </View>

            {/* Other Charges */}
            {order?.othercharges && order.othercharges.length > 0 && (
              <>
                {order.othercharges.map((charge: any, idx: number) => (
                  <View key={idx} style={styles.priceRow}>
                    <Text style={[styles.priceLabel, { color: colors.subText }]}>
                      {charge.ledgerid?.ledgername || 'Other Charge'}
                    </Text>
                    <Text style={[styles.priceValue, { color: colors.text }]}>{formatINR(charge.totalamount)}</Text>
                  </View>
                ))}
              </>
            )}

            <View style={[styles.priceRow, styles.totalRow]}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total Payable</Text>
              <Text style={[styles.totalValue, { color: colors.brand }]}>{formatINR(grand)}</Text>
            </View>
          </Animated.View>

          {/* Transport Details */}
          {order?.isConverted && (order?.transportname || order?.vehiclenumber || order?.ewaybillno) && (
            <Animated.View entering={FadeInUp.duration(400).delay(200)}
              style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>Transport Details</Text>
              {order?.transportname && (
                <View style={styles.infoRow}>
                  <Icon name="truck-outline" size={14} color={colors.subText} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { color: colors.subText }]}>Transport Name</Text>
                    <Text style={[styles.infoText, { color: colors.text }]}>{order.transportname}</Text>
                  </View>
                </View>
              )}
              {order?.vehiclenumber && (
                <View style={styles.infoRow}>
                  <Icon name="license-plate" size={14} color={colors.subText} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { color: colors.subText }]}>Vehicle Number</Text>
                    <Text style={[styles.infoText, { color: colors.text }]}>{order.vehiclenumber}</Text>
                  </View>
                </View>
              )}
              {order?.ewaybillno && (
                <View style={styles.infoRow}>
                  <Icon name="file-document-outline" size={14} color={colors.subText} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { color: colors.subText }]}>E-Way Bill No.</Text>
                    <Text style={[styles.infoText, { color: colors.text }]}>{order.ewaybillno}</Text>
                  </View>
                </View>
              )}
              {order?.deliverydate && (
                <View style={styles.infoRow}>
                  <Icon name="calendar-check-outline" size={14} color={colors.subText} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoLabel, { color: colors.subText }]}>Delivery Date</Text>
                    <Text style={[styles.infoText, { color: colors.text }]}>{formatDate(order.deliverydate)}</Text>
                  </View>
                </View>
              )}
            </Animated.View>
          )}

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
              {!!order.partyacc.channelName && (
                <View style={styles.infoRow}>
                  <Icon name="tag-outline" size={14} color={colors.subText} />
                  <Text style={[styles.infoText, { color: colors.text }]}>{order.partyacc.channelName}</Text>
                </View>
              )}
              {order.partyacc.mobile && (
                <View style={styles.infoRow}>
                  <Icon name="phone-outline" size={14} color={colors.subText} />
                  <Text style={[styles.infoText, { color: colors.text }]}>+91 {order.partyacc.mobile}</Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* Fulfilment actions — field staff only */}
          {canEdit && (
            <TouchableOpacity
              style={[styles.deliverBtn, { backgroundColor: marking ? colors.border : '#6366f1' }]}
              onPress={() => navigation.navigate('OrderEdit', { orderId: id })}
              disabled={marking}
              activeOpacity={0.88}
            >
              <Icon name="pencil-outline" size={18} color="#fff" />
              <Text style={styles.deliverBtnText}>Edit Order</Text>
            </TouchableOpacity>
          )}
          {canConfirm && (
            <TouchableOpacity
              style={[styles.deliverBtn, { backgroundColor: marking ? colors.border : '#3b82f6' }]}
              onPress={handleConfirm}
              disabled={marking}
              activeOpacity={0.88}
            >
              <Icon name="check-circle-outline" size={18} color="#fff" />
              <Text style={styles.deliverBtnText}>{marking ? 'Updating…' : 'Mark Confirmed'}</Text>
            </TouchableOpacity>
          )}
          {canConvert && (
            <TouchableOpacity
              style={[styles.deliverBtn, { backgroundColor: marking ? colors.border : '#f59e0b' }]}
              onPress={handleConvert}
              disabled={marking}
              activeOpacity={0.88}
            >
              <Icon name="file-document-outline" size={18} color="#fff" />
              <Text style={styles.deliverBtnText}>{marking ? 'Updating…' : 'Convert to Invoice'}</Text>
            </TouchableOpacity>
          )}
          {canDispatch && (
            <TouchableOpacity
              style={[styles.deliverBtn, { backgroundColor: marking ? colors.border : '#0ea5e9' }]}
              onPress={handleMarkDispatched}
              disabled={marking}
              activeOpacity={0.88}
            >
              <Icon name="truck-fast-outline" size={18} color="#fff" />
              <Text style={styles.deliverBtnText}>{marking ? 'Updating…' : 'Mark Dispatched'}</Text>
            </TouchableOpacity>
          )}
          {canDeliver && (
            <TouchableOpacity
              style={[styles.deliverBtn, { backgroundColor: marking ? colors.border : '#22c55e' }]}
              onPress={handleMarkDelivered}
              disabled={marking}
              activeOpacity={0.88}
            >
              <Icon name="truck-check-outline" size={18} color="#fff" />
              <Text style={styles.deliverBtnText}>{marking ? 'Updating…' : 'Mark as Delivered'}</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, fontFamily: FONTS.regular },

  card: {
    borderRadius: 20, borderWidth: 1, padding: 16, marginTop: 12,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  cardTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 14 },

  orderHeaderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderNum:    { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 4 },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderDate:   { fontSize: 12, fontFamily: FONTS.regular },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  statusDot:   { width: 7, height: 7, borderRadius: 4 },
  statusText:  { fontSize: 12, fontFamily: FONTS.bold },
  dueText:     { fontSize: 12, fontFamily: FONTS.bold, color: '#ef4444', marginTop: 6 },
  salesmanRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  salesmanText:{ fontSize: 12, fontFamily: FONTS.regular },

  timeline:     { paddingLeft: 4 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 40 },
  timelineLeft: { alignItems: 'center', marginRight: 14, width: 20 },
  timelineDot:  { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  timelineLine: { width: 2, flex: 1, minHeight: 20, marginTop: 2 },
  timelineLabel:{ fontSize: 13, paddingTop: 2, paddingBottom: 12 },

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

  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  infoLabel:{ fontSize: 11, fontFamily: FONTS.regular },
  infoText: { fontSize: 13, fontFamily: FONTS.semiBold, marginTop: 2 },

  deliverBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15, marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  deliverBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
});
