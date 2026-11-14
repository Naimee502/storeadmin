import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client/react';
import { useTheme } from '../../../../config';
import { GET_MY_CONTRACTS, GET_MY_MEMBERSHIPS, REQUEST_CONTRACT_SERVICE } from '../../../../apollo/queries/myservice';
import { Btn, Card, Pill, Screen, dateLabel, daysText, rupees, s, time12 } from './shared';

const STATE: Record<string, [string, string]> = {
  active: ['Active', '#16a34a'], expiring: ['Ending Soon', '#d97706'], expired: ['Expired', '#e11d48'], cancelled: ['Cancelled', '#64748b'], used: ['All Sessions Used', '#64748b'],
};
const usedPct = (start: string, end: string) => {
  const a = Date.parse(`${start}T00:00:00Z`), b = Date.parse(`${end}T00:00:00Z`);
  return b > a ? Math.min(100, Math.max(0, ((Date.now() - a) / (b - a)) * 100)) : 100;
};

/** Customer's AMC and warranty plans with a service request. */
export function MyContracts() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { data, loading, error, refetch } = useQuery(GET_MY_CONTRACTS, { fetchPolicy: 'cache-and-network' });
  const [request, { loading: sending }] = useMutation(REQUEST_CONTRACT_SERVICE);
  useFocusEffect(useCallback(() => { refetch?.().catch(() => {}); }, [refetch]));
  const [asking, setAsking] = useState('');
  const [text, setText] = useState('');
  const rows = ((data as any)?.getMyContracts ?? []) as any[];

  const submit = async (id: string) => {
    if (!text.trim()) { Alert.alert('Details needed', 'Tell us what needs service.'); return; }
    try {
      const { data: r } = await request({ variables: { id, message: text.trim() } });
      setAsking(''); setText('');
      navigation.navigate('MyTicket', { id: (r as any)?.requestMyContractService?.id });
    } catch (e: any) { Alert.alert('Could not send', e?.message || 'Please try again.'); }
  };

  return (
    <Screen title="AMC / Warranty" loading={loading && !rows.length} error={!rows.length ? error?.message : null} empty={!loading && !rows.length ? 'No AMC or warranty yet.' : null} onRefresh={() => refetch()}>
      {rows.map((c) => {
        const [label, color] = STATE[c.state] || STATE.active;
        const live = c.state === 'active' || c.state === 'expiring';
        return (
          <Card key={c.id}>
            <View style={s.row}>
              <Icon name="shield-check-outline" size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { color: colors.text }]}>{c.title || (c.contractType === 'warranty' ? 'Warranty' : 'AMC')}</Text>
                <Text style={[s.sub, { color: colors.subText }]}>{c.contractType === 'warranty' ? 'Warranty' : 'Annual Maintenance Contract'}{c.amount ? ` · ${rupees(c.amount)}` : ''}</Text>
              </View>
              <Pill label={label} color={color} />
            </View>
            <View style={s.row}>
              <Text style={[s.label, { color: colors.subText }]}>{dateLabel(c.startdate)}</Text>
              <Text style={[s.label, { color: colors.text, fontWeight: '600' }]}>{daysText(c.daysleft)}</Text>
              <Text style={[s.label, { color: colors.subText }]}>{dateLabel(c.enddate)}</Text>
            </View>
            <View style={[s.bar, { backgroundColor: colors.border }]}><View style={{ height: '100%', width: `${usedPct(c.startdate, c.enddate)}%`, backgroundColor: c.state === 'expiring' ? '#f59e0b' : c.state === 'active' ? colors.brand : '#cbd5e1' }} /></View>
            {c.visitsallowed ? <Text style={[s.sub, { color: colors.text }]}>Service visits: {c.visitsdone || 0} of {c.visitsallowed} used</Text> : null}
            {c.items.length > 0 && (
              <View>
                <Text style={[s.label, { color: colors.subText }]}>Covered Items</Text>
                {c.items.map((i: any, k: number) => <Text key={k} style={[s.sub, { color: colors.text }]}>• {i.name || 'Item'}{i.serial ? ` · S/N ${i.serial}` : ''}{i.note ? ` · ${i.note}` : ''}</Text>)}
              </View>
            )}
            {!!c.notes && <Text style={[s.sub, { color: colors.subText }]}>{c.notes}</Text>}
            {live && (asking === c.id ? (
              <>
                <TextInput value={text} onChangeText={setText} multiline autoFocus placeholder="What needs service?" placeholderTextColor={colors.subText}
                  style={[s.input, { color: colors.text, borderColor: colors.border, minHeight: 60 }]} />
                <View style={s.row}>
                  <Btn label="Cancel" kind="outline" onPress={() => setAsking('')} />
                  <Btn label={sending ? 'Sending...' : 'Send Request'} disabled={sending} onPress={() => submit(c.id)} />
                </View>
              </>
            ) : <Btn label="Request Service" kind="outline" onPress={() => { setAsking(c.id); setText(''); }} icon={<Icon name="wrench-outline" size={16} color={colors.text} />} />)}
            {c.state === 'expired' && <Text style={[s.sub, { color: '#e11d48' }]}>This plan has ended. Contact us to renew it.</Text>}
          </Card>
        );
      })}
    </Screen>
  );
}

const VISIT: Record<string, string> = { booked: 'Booked', confirmed: 'Confirmed', arrived: 'Arrived', done: 'Used', noshow: 'Missed', cancelled: 'Cancelled' };

/** Customer's memberships: plan, validity, sessions and visits. */
export function MyMemberships() {
  const { colors } = useTheme();
  const { data, loading, error, refetch } = useQuery(GET_MY_MEMBERSHIPS, { fetchPolicy: 'cache-and-network' });
  useFocusEffect(useCallback(() => { refetch?.().catch(() => {}); }, [refetch]));
  const rows = ((data as any)?.getMyMemberships ?? []) as any[];
  return (
    <Screen title="My Membership" loading={loading && !rows.length} error={!rows.length ? error?.message : null} empty={!loading && !rows.length ? 'No membership yet.' : null} onRefresh={() => refetch()}>
      {rows.map((m) => {
        const [label, color] = STATE[m.state] || STATE.active;
        return (
          <Card key={m.id}>
            <View style={s.row}>
              <Icon name="card-account-details-star-outline" size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { color: colors.text }]}>{m.plan}</Text>
                <Text style={[s.sub, { color: colors.subText }]}>From {dateLabel(m.startdate)}{m.enddate ? ` to ${dateLabel(m.enddate)}` : ''}{m.amount ? ` · ${rupees(m.amount)}` : ''}</Text>
              </View>
              <Pill label={label} color={color} />
            </View>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={[s.label, { color: colors.subText }]}>{m.sessions ? 'Sessions left' : 'Visits used'}</Text>
                <Text style={[s.big, { color: colors.text }]}>{m.sessions ? `${m.sessionsleft} / ${m.sessions}` : m.sessionsused}</Text>
              </View>
              {m.daysleft != null && <View style={{ flex: 1 }}><Text style={[s.label, { color: colors.subText }]}>Validity</Text><Text style={[s.value, { color: colors.text }]}>{daysText(m.daysleft)}</Text></View>}
            </View>
            {m.sessions ? <View style={[s.bar, { backgroundColor: colors.border }]}><View style={{ height: '100%', width: `${Math.min(100, (m.sessionsused / m.sessions) * 100)}%`, backgroundColor: colors.brand }} /></View> : null}
            {m.services.length > 0 && <Text style={[s.sub, { color: colors.text }]}>Covers: {m.services.join(', ')}</Text>}
            {m.visits.length > 0 && <Text style={[s.label, { color: colors.subText, marginTop: 4 }]}>Visits</Text>}
            {m.visits.map((v: any) => (
              <View key={v.id} style={s.row}>
                <Text style={[s.sub, { color: colors.text, flex: 1 }]} numberOfLines={1}>{dateLabel(v.billdate)}{v.starttime ? `, ${time12(v.starttime)}` : ''}{v.service ? ` · ${v.service}` : ''}</Text>
                <Text style={[s.label, { color: colors.subText }]}>{VISIT[v.apptStatus] || v.apptStatus}</Text>
              </View>
            ))}
            {m.state === 'expiring' && <Text style={[s.sub, { color: '#b45309' }]}>Your membership is ending soon. Contact us to renew.</Text>}
          </Card>
        );
      })}
    </Screen>
  );
}
