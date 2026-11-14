import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@apollo/client/react';
import { useTheme } from '../../../../config';
import { GET_MY_LOYALTY } from '../../../../apollo/queries/myservice';
import { Card, Screen, rupees, s, whenLabel } from './shared';

const KIND: Record<string, string> = { earn: 'Earned', redeem: 'Used', expire: 'Expired', adjust: 'Added by shop' };

/** Customer's loyalty points: balance, rules and history. */
export function MyPoints() {
  const { colors } = useTheme();
  const { data, loading, error, refetch } = useQuery(GET_MY_LOYALTY, { fetchPolicy: 'cache-and-network' });
  useFocusEffect(useCallback(() => { refetch?.().catch(() => {}); }, [refetch]));
  const a = (data as any)?.getMyLoyalty;
  const r = a?.rules;
  return (
    <Screen title="My Points" loading={loading && !a} error={!a ? error?.message : null}
      empty={!loading && a && !r?.enabled ? 'Loyalty points are not available right now.' : null} onRefresh={() => refetch()}>
      {a && r?.enabled && (
        <>
          <Card style={{ backgroundColor: colors.brand, borderColor: colors.brand }}>
            <View style={[s.row, { justifyContent: 'flex-start', gap: 12 }]}>
              <Icon name="gift-outline" size={30} color={colors.onBrand} />
              <View>
                <Text style={[s.label, { color: colors.onBrand }]}>POINTS BALANCE</Text>
                <Text style={[s.big, { color: colors.onBrand, fontSize: 28 }]}>{a.balance}</Text>
                <Text style={[s.sub, { color: colors.onBrand }]}>Worth {rupees(a.value)} on your next order</Text>
              </View>
            </View>
          </Card>
          <View style={[s.row, { alignItems: 'stretch' }]}>
            <Card style={{ flex: 1 }}><Text style={[s.label, { color: colors.subText }]}>Total Earned</Text><Text style={[s.big, { color: colors.text }]}>{a.earned}</Text></Card>
            <Card style={{ flex: 1 }}><Text style={[s.label, { color: colors.subText }]}>Total Used</Text><Text style={[s.big, { color: colors.text }]}>{a.redeemed}</Text></Card>
          </View>
          <Card>
            <Text style={[s.name, { color: colors.text }]}>How it works</Text>
            <Text style={[s.sub, { color: colors.subText }]}>• Earn {r.earnPer100} point{r.earnPer100 === 1 ? '' : 's'} for every ₹100{r.minBill > 0 ? ` (bills from ${rupees(r.minBill)})` : ''}{r.maxEarn > 0 ? `, up to ${r.maxEarn} per bill` : ''}.</Text>
            <Text style={[s.sub, { color: colors.subText }]}>• 1 point = {rupees(r.pointValue)} off at checkout{r.minRedeem > 0 ? `, from ${r.minRedeem} points` : ''}{r.maxRedeemPercent < 100 ? `, up to ${r.maxRedeemPercent}% of an order` : ''}.</Text>
            <Text style={[s.sub, { color: colors.subText }]}>• {r.expiryDays > 0 ? `Points expire ${r.expiryDays} days after you earn them.` : 'Points never expire.'}</Text>
          </Card>
          <Card>
            <Text style={[s.name, { color: colors.text }]}>History</Text>
            {!a.history.length ? <Text style={[s.sub, { color: colors.subText }]}>No points yet. Place an order to start earning.</Text>
              : a.history.map((h: any) => (
                <View key={h.id} style={[s.row, { paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.value, { color: colors.text }]}>{KIND[h.kind] || h.kind}{h.docno ? ` · ${h.docno}` : ''}</Text>
                    <Text style={[s.label, { color: colors.subText }]}>{whenLabel(h.createdAt)}{h.note ? ` · ${h.note}` : ''}</Text>
                  </View>
                  <Text style={[s.value, { color: h.points < 0 ? '#e11d48' : '#16a34a' }]}>{h.points > 0 ? '+' : ''}{h.points}</Text>
                </View>
              ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
