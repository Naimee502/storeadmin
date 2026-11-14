import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client/react';
import { useTheme } from '../../../../config';
import { ADD_MY_TICKET, GET_MY_TICKET, GET_MY_TICKETS, REPLY_MY_TICKET, SET_MY_TICKET_STATUS } from '../../../../apollo/queries/myservice';
import { Btn, Card, Pill, Screen, s, whenLabel } from './shared';

export const TICKET_STATUS: Record<string, [string, string]> = {
  open: ['Open', '#d97706'], inprogress: ['In Progress', '#0284c7'], waiting: ['Waiting for You', '#7c3aed'],
  resolved: ['Resolved', '#16a34a'], closed: ['Closed', '#64748b'],
};
const CATEGORIES = ['Product Issue', 'Service / Repair', 'Billing / Payment', 'Delivery', 'AMC', 'Warranty', 'Other'];
const PRIORITIES: [string, string][] = [['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']];

/** Customer's support tickets with a form to raise a new one. */
export function MyTickets() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { data, loading, error, refetch } = useQuery(GET_MY_TICKETS, { fetchPolicy: 'cache-and-network' });
  const [add, { loading: saving }] = useMutation(ADD_MY_TICKET);
  useFocusEffect(useCallback(() => { refetch?.().catch(() => {}); }, [refetch]));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: '', category: '', description: '', priority: 'normal' });
  const rows = ((data as any)?.getSupportTickets ?? []) as any[];

  const submit = async () => {
    if (!form.subject.trim()) { Alert.alert('Subject needed', 'Write a short subject.'); return; }
    try {
      const { data: r } = await add({ variables: { input: { ...form, subject: form.subject.trim() } } });
      setOpen(false); setForm({ subject: '', category: '', description: '', priority: 'normal' });
      await refetch();
      const id = (r as any)?.addSupportTicket?.id;
      if (id) navigation.navigate('MyTicket', { id });
    } catch (e: any) { Alert.alert('Could not raise ticket', e?.message || 'Please try again.'); }
  };
  const chip = (on: boolean, label: string, onPress: () => void) => (
    <Text key={label} onPress={onPress} style={[s.pill, { color: on ? '#fff' : colors.text, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brand : 'transparent', paddingVertical: 5, paddingHorizontal: 10 }]}>{label}</Text>
  );

  return (
    <Screen title="Support Tickets" loading={loading && !rows.length && !open} error={!rows.length ? error?.message : null} onRefresh={() => refetch()}>
      {open ? (
        <Card>
          <Text style={[s.title, { color: colors.text }]}>New Ticket</Text>
          <TextInput value={form.subject} onChangeText={(t) => setForm({ ...form, subject: t })} maxLength={200} placeholder="Subject (e.g. AC not cooling)" placeholderTextColor={colors.subText}
            style={[s.input, { color: colors.text, borderColor: colors.border }]} />
          <Text style={[s.label, { color: colors.subText }]}>Category</Text>
          <View style={s.wrap}>{CATEGORIES.map((c) => chip(form.category === c, c, () => setForm({ ...form, category: form.category === c ? '' : c })))}</View>
          <Text style={[s.label, { color: colors.subText }]}>Priority</Text>
          <View style={s.wrap}>{PRIORITIES.map(([v, l]) => chip(form.priority === v, l, () => setForm({ ...form, priority: v })))}</View>
          <TextInput value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} multiline placeholder="Tell us what happened" placeholderTextColor={colors.subText}
            style={[s.input, { color: colors.text, borderColor: colors.border, minHeight: 90 }]} />
          <View style={s.row}>
            <Btn label="Cancel" kind="outline" onPress={() => setOpen(false)} />
            <Btn label={saving ? 'Sending...' : 'Submit Ticket'} onPress={submit} disabled={saving} />
          </View>
        </Card>
      ) : <Btn label="Raise a Ticket" onPress={() => setOpen(true)} icon={<Icon name="plus" size={16} color="#fff" />} />}
      {!rows.length && !loading && <Text style={[s.sub, { color: colors.subText, textAlign: 'center', marginTop: 12 }]}>No tickets yet. Raise one if you need help.</Text>}
      {rows.map((t) => {
        const [label, color] = TICKET_STATUS[t.ticketstatus] || TICKET_STATUS.open;
        const last = t.comments[t.comments.length - 1];
        return (
          <Card key={t.id} onPress={() => navigation.navigate('MyTicket', { id: t.id })}>
            <View style={s.row}>
              <Text style={[s.name, { color: colors.text, flex: 1 }]} numberOfLines={1}>{t.subject}</Text>
              <Pill label={label} color={color} />
            </View>
            <Text style={[s.sub, { color: colors.subText }]}>{t.ticketno}{t.category ? ` · ${t.category}` : ''} · {whenLabel(t.createdAt)}</Text>
            {last && <Text style={[s.sub, { color: colors.text }]} numberOfLines={1}>{last.bytype === 'party' ? 'You' : last.byname || 'Support'}: {last.text}</Text>}
          </Card>
        );
      })}
    </Screen>
  );
}

/** One ticket: conversation, reply, close or reopen. */
export function MyTicket() {
  const { colors } = useTheme();
  const { id } = (useRoute<any>().params || {}) as { id: string };
  const { data, loading, error, refetch } = useQuery(GET_MY_TICKET, { variables: { id }, fetchPolicy: 'cache-and-network', pollInterval: 30000 });
  const [reply, { loading: sending }] = useMutation(REPLY_MY_TICKET);
  const [setStatus, { loading: changing }] = useMutation(SET_MY_TICKET_STATUS);
  const [text, setText] = useState('');
  const t = (data as any)?.getSupportTicketById;
  const done = t && ['resolved', 'closed'].includes(t.ticketstatus);

  const send = async () => {
    if (!text.trim()) return;
    try { await reply({ variables: { id, text: text.trim() } }); setText(''); }
    catch (e: any) { Alert.alert('Could not send', e?.message || 'Please try again.'); }
  };
  const status = async (st: string) => {
    try { await setStatus({ variables: { id, ticketstatus: st } }); } catch (e: any) { Alert.alert('Could not update', e?.message || 'Please try again.'); }
  };

  return (
    <Screen title={t?.ticketno || 'Ticket'} loading={loading && !t} error={!t ? error?.message || (!loading ? 'Ticket not found.' : null) : null} onRefresh={() => refetch()}>
      {t && (
        <>
          <Card>
            <View style={s.row}>
              <Text style={[s.title, { color: colors.text, flex: 1 }]}>{t.subject}</Text>
              <Pill label={(TICKET_STATUS[t.ticketstatus] || TICKET_STATUS.open)[0]} color={(TICKET_STATUS[t.ticketstatus] || TICKET_STATUS.open)[1]} />
            </View>
            <Text style={[s.sub, { color: colors.subText }]}>Raised {whenLabel(t.createdAt)}{t.category ? ` · ${t.category}` : ''} · {t.priority} priority</Text>
            {!!t.description && <Text style={[s.sub, { color: colors.text }]}>{t.description}</Text>}
          </Card>
          {t.comments.map((c: any) => {
            const mine = c.bytype === 'party';
            return (
              <View key={c.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={{ maxWidth: '85%', borderRadius: 14, padding: 10, backgroundColor: mine ? colors.brand : colors.cardGlass, borderWidth: mine ? 0 : 1, borderColor: colors.border }}>
                  <Text style={[s.label, { color: mine ? 'rgba(255,255,255,0.8)' : colors.subText }]}>{mine ? 'You' : c.byname || 'Support'} · {whenLabel(c.createdAt)}</Text>
                  <Text style={[s.sub, { color: mine ? '#fff' : colors.text, fontSize: 13 }]}>{c.text}</Text>
                </View>
              </View>
            );
          })}
          {!t.comments.length && <Text style={[s.sub, { color: colors.subText, textAlign: 'center' }]}>No replies yet. We will get back to you soon.</Text>}
          {done ? (
            <>
              <Text style={[s.sub, { color: colors.subText, textAlign: 'center' }]}>This ticket is {t.ticketstatus}. Reopen it to write again.</Text>
              <Btn label="Reopen Ticket" kind="outline" disabled={changing} onPress={() => status('open')} />
            </>
          ) : (
            <>
              <TextInput value={text} onChangeText={setText} multiline placeholder="Write a reply" placeholderTextColor={colors.subText}
                style={[s.input, { color: colors.text, borderColor: colors.border, minHeight: 60 }]} />
              <View style={s.row}>
                <Btn label="Close Ticket" kind="outline" disabled={changing} onPress={() => status('closed')} />
                <Btn label={sending ? 'Sending...' : 'Send'} disabled={sending || !text.trim()} onPress={send} icon={<Icon name="send" size={16} color="#fff" />} />
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
