import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Alert, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client/react';
import { useTheme } from '../../../../config';
import { API_CONFIG } from '../../../../config/apiconfig';
import { GET_MY_JOBCARD, GET_MY_JOBCARDS, MY_JOBCARD_PRINT_LINK, RESPOND_MY_ESTIMATE } from '../../../../apollo/queries/myservice';
import { Btn, Card, Pill, Screen, dateLabel, rupees, s } from './shared';

const STEPS = ['received', 'diagnosing', 'waitingapproval', 'inprogress', 'ready', 'delivered'];
const STEP_LABEL: Record<string, string> = { received: 'Received', diagnosing: 'Checking', waitingapproval: 'Estimate', inprogress: 'Repairing', ready: 'Ready', delivered: 'Delivered' };
export const JOB_STATUS: Record<string, [string, string]> = {
  received: ['Received', '#64748b'], diagnosing: ['Checking', '#0284c7'], waitingapproval: ['Waiting for Your Approval', '#d97706'],
  inprogress: ['Repairing', '#4f46e5'], ready: ['Ready to Collect', '#16a34a'], delivered: ['Delivered', '#16a34a'], cancelled: ['Cancelled', '#e11d48'],
};

/** Customer's repair jobs. */
export function MyRepairs() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { data, loading, error, refetch } = useQuery(GET_MY_JOBCARDS, { fetchPolicy: 'cache-and-network' });
  useFocusEffect(useCallback(() => { refetch?.().catch(() => {}); }, [refetch]));
  const rows = ((data as any)?.getMyJobCards ?? []) as any[];
  return (
    <Screen title="My Repairs" loading={loading && !rows.length} error={!rows.length ? error?.message : null} empty={!loading && !rows.length ? 'No repair jobs yet.' : null} onRefresh={() => refetch()}>
      {rows.map((j) => {
        const [label, color] = JOB_STATUS[j.jobStatus] || JOB_STATUS.received;
        return (
          <Card key={j.id} onPress={() => navigation.navigate('MyRepair', { id: j.id })}>
            <View style={s.row}>
              <Text style={[s.name, { color: colors.text, flex: 1 }]} numberOfLines={1}>{j.device || 'Repair'}{j.serial ? ` · ${j.serial}` : ''}</Text>
              <Pill label={label} color={color} />
            </View>
            <Text style={[s.sub, { color: colors.subText }]}>{j.billnumber} · {dateLabel(j.billdate)}{j.promisedate ? ` · Promised ${dateLabel(j.promisedate)}` : ''}</Text>
            {!!j.problem && <Text style={[s.sub, { color: colors.text }]} numberOfLines={1}>{j.problem}</Text>}
            {j.canApprove && <Text style={[s.sub, { color: '#b45309', fontWeight: '600' }]}>Estimate {rupees(j.estimatetotal)} is waiting for your approval</Text>}
          </Card>
        );
      })}
    </Screen>
  );
}

/** One repair: status steps, details, estimate approval and job sheet. */
export function MyRepair() {
  const { colors } = useTheme();
  const { id } = (useRoute<any>().params || {}) as { id: string };
  const { data, loading, error, refetch } = useQuery(GET_MY_JOBCARD, { variables: { id }, fetchPolicy: 'cache-and-network' });
  const [respond, { loading: answering }] = useMutation(RESPOND_MY_ESTIMATE);
  const [printLink, { loading: printing }] = useMutation(MY_JOBCARD_PRINT_LINK);
  const [note, setNote] = useState('');
  const j = (data as any)?.getMyJobCard;
  const at = j ? (j.jobStatus === 'cancelled' ? -1 : STEPS.indexOf(j.jobStatus)) : -1;

  const answer = (approve: boolean) => {
    const go = async () => {
      try {
        await respond({ variables: { id, approve, note: note.trim() || undefined } });
        setNote('');
        Alert.alert(approve ? 'Approved' : 'Rejected', approve ? 'Thank you. Repair work will start now.' : 'We have told the shop. They will contact you.');
      } catch (e: any) { Alert.alert('Could not send', e?.message || 'Please try again.'); }
    };
    if (approve) go(); else Alert.alert('Reject estimate?', 'The shop will contact you.', [{ text: 'Keep', style: 'cancel' }, { text: 'Reject', style: 'destructive', onPress: go }]);
  };
  const print = async () => {
    try {
      const { data: r } = await printLink({ variables: { id } });
      await Linking.openURL(`${API_CONFIG.GRAPHQL_URL.replace(/\/graphql$/, '')}${(r as any)?.myJobCardPrintLink}`);
    } catch (e: any) { Alert.alert('Could not open job sheet', e?.message || 'Please try again.'); }
  };
  const info = (label: string, value?: string | null) => value ? (
    <View style={{ width: '48%' }}><Text style={[s.label, { color: colors.subText }]}>{label}</Text><Text style={[s.value, { color: colors.text }]}>{value}</Text></View>
  ) : null;

  return (
    <Screen title={j?.billnumber || 'Repair'} loading={loading && !j} error={!j ? error?.message || (!loading ? 'Repair job not found.' : null) : null} onRefresh={() => refetch()}>
      {j && (
        <>
          <Card>
            <View style={s.row}>
              <Text style={[s.title, { color: colors.text, flex: 1 }]}>{j.device || 'Repair'}</Text>
              <Pill label={(JOB_STATUS[j.jobStatus] || JOB_STATUS.received)[0]} color={(JOB_STATUS[j.jobStatus] || JOB_STATUS.received)[1]} />
            </View>
            {j.jobStatus === 'cancelled' ? <Text style={[s.sub, { color: '#e11d48' }]}>This repair job was cancelled.</Text> : (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                {STEPS.map((st, i) => (
                  <View key={st} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: i <= at ? colors.brand : colors.border }}>
                      {i < at ? <Icon name="check" size={14} color="#fff" /> : <Text style={{ color: i <= at ? '#fff' : colors.subText, fontSize: 11 }}>{i + 1}</Text>}
                    </View>
                    <Text style={[s.label, { color: i <= at ? colors.text : colors.subText, marginTop: 3, fontSize: 10 }]}>{STEP_LABEL[st]}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
          <Card>
            <View style={[s.wrap, { rowGap: 10 }]}>
              {info('Job No.', j.billnumber)}{info('Received On', dateLabel(j.billdate))}{info('Promised Date', j.promisedate ? dateLabel(j.promisedate) : null)}
              {info('Serial / IMEI', j.serial)}{info('Technician', j.technician)}{info('Accessories Given', j.accessories)}
              {j.deliveredAt ? info('Delivered On', dateLabel(j.deliveredAt)) : null}
              {j.warrantydays ? info('Repair Warranty', `${j.warrantydays} days${j.warrantyTill ? ` (till ${dateLabel(j.warrantyTill)})` : ''}`) : null}
            </View>
            {!!j.problem && <View style={{ marginTop: 6 }}><Text style={[s.label, { color: colors.subText }]}>Problem Reported</Text><Text style={[s.value, { color: colors.text }]}>{j.problem}</Text></View>}
          </Card>
          {j.estimate.length > 0 && (
            <Card>
              <View style={s.row}>
                <Text style={[s.title, { color: colors.text }]}>Estimate</Text>
                {j.approved === true && <Pill label="Approved" color="#16a34a" />}
                {j.approved === false && <Pill label="Rejected" color="#e11d48" />}
              </View>
              {j.estimate.map((l: any, i: number) => (
                <View key={i} style={s.row}>
                  <Text style={[s.sub, { color: colors.text, flex: 1 }]}>{l.name} · {l.qty} × {rupees(l.rate)}</Text>
                  <Text style={[s.sub, { color: colors.text }]}>{rupees(l.amount)}</Text>
                </View>
              ))}
              <View style={[s.row, { borderTopWidth: 1, borderColor: colors.border, paddingTop: 6 }]}>
                <Text style={[s.name, { color: colors.text }]}>Estimate Total</Text>
                <Text style={[s.name, { color: colors.text }]}>{rupees(j.estimatetotal)}</Text>
              </View>
              {j.canApprove && (
                <>
                  <Text style={[s.sub, { color: '#b45309' }]}>Please approve this estimate so we can start the repair.</Text>
                  <TextInput value={note} onChangeText={setNote} multiline placeholder="Message for the shop (optional)" placeholderTextColor={colors.subText}
                    style={[s.input, { color: colors.text, borderColor: colors.border, minHeight: 50 }]} />
                  <View style={s.row}>
                    <Btn label="Reject" kind="danger" disabled={answering} onPress={() => answer(false)} />
                    <Btn label={`Approve ${rupees(j.estimatetotal)}`} disabled={answering} onPress={() => answer(true)} />
                  </View>
                </>
              )}
            </Card>
          )}
          {!!j.notes && <Card><Text style={[s.label, { color: colors.subText }]}>Notes</Text><Text style={[s.sub, { color: colors.text }]}>{j.notes}</Text></Card>}
          <Btn label={printing ? 'Opening...' : 'Job Sheet / PDF'} kind="outline" disabled={printing} onPress={print} icon={<Icon name="printer-outline" size={16} color={colors.text} />} />
        </>
      )}
    </Screen>
  );
}
