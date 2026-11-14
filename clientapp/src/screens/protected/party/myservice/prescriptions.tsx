import React, { useCallback } from 'react';
import { View, Text, Alert, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client/react';
import { useTheme } from '../../../../config';
import { API_CONFIG } from '../../../../config/apiconfig';
import { GET_MY_PRESCRIPTION, GET_MY_PRESCRIPTIONS, MY_PRESCRIPTION_PRINT_LINK } from '../../../../apollo/queries/myservice';
import { Btn, Card, Screen, dateLabel, s } from './shared';

const TIMING: Record<string, string> = { before: 'Before food', after: 'After food', empty: 'Empty stomach', bedtime: 'At bedtime' };
const dr = (r: any) => (r?.doctorname ? (/^dr\.?\s/i.test(r.doctorname) ? r.doctorname : `Dr. ${r.doctorname}`) : 'Doctor');

/** Patient's prescriptions, newest first. */
export function MyPrescriptions() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { data, loading, error, refetch } = useQuery(GET_MY_PRESCRIPTIONS, { fetchPolicy: 'cache-and-network' });
  useFocusEffect(useCallback(() => { refetch?.().catch(() => {}); }, [refetch]));
  const rows = ((data as any)?.getMyPrescriptions ?? []) as any[];
  return (
    <Screen title="My Prescriptions" loading={loading && !rows.length} error={!rows.length ? error?.message : null}
      empty={!loading && !rows.length ? 'No prescriptions yet.' : null} onRefresh={() => refetch()}>
      {rows.map((r) => (
        <Card key={r.id} onPress={() => navigation.navigate('MyPrescription', { id: r.id })}>
          <View style={s.row}>
            <Icon name="stethoscope" size={22} color={colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={[s.name, { color: colors.text }]}>{dr(r)}</Text>
              <Text style={[s.sub, { color: colors.subText }]}>RX-{r.rxnumber} · {dateLabel(r.billdate)}</Text>
            </View>
            <Text style={[s.label, { color: colors.subText }]}>{r.medicines.length} medicine{r.medicines.length === 1 ? '' : 's'}</Text>
          </View>
          {!!(r.diagnosis || r.complaints) && <Text style={[s.sub, { color: colors.text }]}>{r.diagnosis || r.complaints}</Text>}
          {!!r.nextvisit && <Text style={[s.sub, { color: colors.brand }]}>Next visit {dateLabel(r.nextvisit)}</Text>}
        </Card>
      ))}
    </Screen>
  );
}

/** One prescription with medicines and a print copy. */
export function MyPrescription() {
  const { colors } = useTheme();
  const id = (useRoute<any>().params?.id ?? '') as string;
  const { data, loading, error, refetch } = useQuery(GET_MY_PRESCRIPTION, { variables: { id }, skip: !id, fetchPolicy: 'cache-and-network' });
  const [printLink, { loading: printing }] = useMutation(MY_PRESCRIPTION_PRINT_LINK);
  const r = (data as any)?.getMyPrescription;
  const print = async () => {
    try {
      const { data: p } = await printLink({ variables: { id } });
      await Linking.openURL(`${API_CONFIG.GRAPHQL_URL.replace(/\/graphql$/, '')}${(p as any)?.myPrescriptionPrintLink}`);
    } catch (e: any) { Alert.alert('Could not open prescription', e?.message || 'Please try again.'); }
  };
  const v = r?.vitals || {};
  const vitals = [['BP', v.bp], ['Pulse', v.pulse], ['Temp', v.temperature], ['Weight', v.weight], ['SpO2', v.spo2], ['Sugar', v.sugar]].filter(([, x]) => x);
  return (
    <Screen title={r ? `RX-${r.rxnumber}` : 'Prescription'} loading={loading && !r} error={!r ? error?.message : null} onRefresh={() => refetch()}
      footer={r ? <View style={{ padding: 16 }}><Btn label={printing ? 'Opening...' : 'Print / Save PDF'} disabled={printing} onPress={print} icon={<Icon name="printer-outline" size={16} color="#fff" />} /></View> : null}>
      {r && (
        <>
          <Card>
            <Text style={[s.name, { color: colors.text }]}>{dr(r)}{r.doctorqualification ? `, ${r.doctorqualification}` : ''}</Text>
            <Text style={[s.sub, { color: colors.subText }]}>{dateLabel(r.billdate)}</Text>
            {!!r.complaints && <Text style={[s.sub, { color: colors.text }]}>Complaints: {r.complaints}</Text>}
            {!!r.diagnosis && <Text style={[s.sub, { color: colors.text }]}>Diagnosis: {r.diagnosis}</Text>}
            {vitals.length > 0 && <Text style={[s.sub, { color: colors.subText }]}>{vitals.map(([l, x]) => `${l}: ${x}`).join('   ')}</Text>}
          </Card>
          <Card>
            <Text style={[s.name, { color: colors.text }]}>Medicines</Text>
            {!r.medicines.length ? <Text style={[s.sub, { color: colors.subText }]}>No medicines.</Text> : r.medicines.map((m: any, i: number) => (
              <View key={i} style={{ paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                <Text style={[s.value, { color: colors.text }]}>{m.name}</Text>
                <Text style={[s.sub, { color: colors.subText }]}>{[m.dose, m.frequency, TIMING[m.timing] || m.timing, m.days ? `${m.days} days` : ''].filter(Boolean).join(' · ')}</Text>
                {!!m.notes && <Text style={[s.label, { color: colors.subText }]}>{m.notes}</Text>}
              </View>
            ))}
          </Card>
          {!!(r.tests || r.advice || r.nextvisit) && (
            <Card>
              {!!r.tests && <Text style={[s.sub, { color: colors.text }]}>Tests: {r.tests}</Text>}
              {!!r.advice && <Text style={[s.sub, { color: colors.text }]}>Advice: {r.advice}</Text>}
              {!!r.nextvisit && <Text style={[s.value, { color: colors.brand }]}>Next visit {dateLabel(r.nextvisit)}</Text>}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}
