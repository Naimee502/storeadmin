import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert,
  Modal, KeyboardAvoidingView, Platform, ScrollView, TextInput, Switch,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../config';
import { AppHeader, DynamicFlashList } from '../../../components';
import { formatDate } from '../../../utils';
import {
  useAttendanceSummaryQuery, useAttendanceLogsQuery, useOpenPunchQuery,
  useLeaveRequestsQuery, useLeaveTypesQuery, useAttendanceMutations,
} from '../../../apollo/hooks/attendance';
import type { RootState } from '../../../store/rootreducer';

// Fallback leave types if the admin hasn't configured any yet.
const FALLBACK_LEAVE_TYPES = [
  { id: 'cl',  name: 'Casual Leave',    code: 'CL', color: '#6366f1' },
  { id: 'sl',  name: 'Sick Leave',      code: 'SL', color: '#22c55e' },
  { id: 'el',  name: 'Earned Leave',    code: 'EL', color: '#f59e0b' },
  { id: 'eml', name: 'Emergency Leave', code: 'EM', color: '#ef4444' },
];

const STATUS_META: Record<string, { color: string; icon: string; label: string }> = {
  present:  { color: '#22c55e', icon: 'check-circle-outline',    label: 'Present'  },
  halfday:  { color: '#14b8a6', icon: 'circle-half-full',        label: 'Half Day' },
  absent:   { color: '#ef4444', icon: 'close-circle-outline',    label: 'Absent'   },
  leave:    { color: '#f59e0b', icon: 'calendar-remove-outline', label: 'Leave'    },
  holiday:  { color: '#8b5cf6', icon: 'star-circle-outline',     label: 'Holiday'  },
  weekoff:  { color: '#94a3b8', icon: 'calendar-weekend-outline',label: 'Week Off' },
};

const LEAVE_STATUS: Record<string, { color: string; label: string }> = {
  pending:   { color: '#f59e0b', label: 'Pending'   },
  approved:  { color: '#22c55e', label: 'Approved'  },
  rejected:  { color: '#ef4444', label: 'Rejected'  },
  cancelled: { color: '#94a3b8', label: 'Cancelled' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMinutes(min: number) {
  if (!min) return '–';
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}
function fmtDate(d: Date) {
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
// Local YYYY-MM-DD (NOT toISOString, which shifts to the previous day in +ve timezones like IST).
function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(a: Date, b: Date) { return Math.max(Math.round((b.getTime() - a.getTime()) / 86400000) + 1, 1); }
// Extract HH:MM (24h) from an ISO/date string timestamp.
function fmtTime(ts?: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

export default function AttendanceScreen() {
  const { colors, isDark } = useTheme();
  const user    = useSelector((s: RootState) => s.auth.user);
  const tenant  = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';
  const branchid = tenant.branchId ?? '';

  const { data: summaryData, refetch: refetchSummary } = useAttendanceSummaryQuery();
  const { data: logsData,    refetch: refetchLogs }    = useAttendanceLogsQuery();
  const { data: openData,    refetch: refetchOpen }    = useOpenPunchQuery();
  const { data: leavesData,  refetch: refetchLeaves }  = useLeaveRequestsQuery();
  const { data: typesData }                            = useLeaveTypesQuery();
  const { punchMutation, addLeaveRequestMutation, cancelLeaveRequestMutation } = useAttendanceMutations();

  useFocusEffect(useCallback(() => {
    refetchSummary?.(); refetchLogs?.(); refetchOpen?.(); refetchLeaves?.();
  }, [refetchSummary, refetchLogs, refetchOpen, refetchLeaves]));

  const summary = (summaryData as any)?.getAttendanceSummary;
  const present = summary?.presentDays ?? 0;
  const absent  = summary?.absentDays ?? 0;
  const leave   = summary?.leaveDays ?? 0;
  const workDays = summary?.totalDays ?? 0;

  const logs = useMemo(() => ((logsData as any)?.getAttendanceLogs ?? []).map((l: any) => ({
    id: l.id, date: l.date, status: l.status,
    inTime:  fmtTime(l.firstPunchIn),
    outTime: fmtTime(l.lastPunchOut),
    totalWorkMinutes: l.totalWorkMinutes ?? 0,
  })), [logsData]);

  const leaves = useMemo(() => ((leavesData as any)?.getLeaveRequests ?? []).map((lv: any) => ({
    id: lv.id,
    type: lv.leavetypeid?.name ?? 'Leave',
    typeColor: lv.leavetypeid?.color ?? '#6366f1',
    fromDate: lv.fromDate, toDate: lv.toDate,
    totalDays: lv.totalDays, reason: lv.reason, status: lv.status,
  })), [leavesData]);

  const leaveTypes = useMemo(() => {
    const t = (typesData as any)?.getLeaveTypes ?? [];
    return t.length > 0
      ? t.map((x: any) => ({ id: x.id, name: x.name, code: x.code, color: x.color ?? '#6366f1' }))
      : FALLBACK_LEAVE_TYPES;
  }, [typesData]);

  const isPunchedIn = !!(openData as any)?.getOpenPunch;

  const [punching, setPunching] = useState(false);

  // apply leave modal state
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [showModal,   setShowModal]   = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState<string>('');
  const [fromDate,    setFromDate]    = useState(today);
  const [toDate,      setToDate]      = useState(today);
  const [halfDay,     setHalfDay]     = useState(false);
  const [halfSession, setHalfSession] = useState<'first'|'second'>('first');
  const [reason,      setReason]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const selectedType = leaveTypes.find((t: any) => t.id === leaveTypeId) ?? leaveTypes[0];
  const totalDays    = halfDay ? 0.5 : daysBetween(fromDate, toDate);

  const resetForm = () => {
    setLeaveTypeId(leaveTypes[0]?.id ?? '');
    setFromDate(today); setToDate(today);
    setHalfDay(false); setHalfSession('first'); setReason('');
  };

  const handlePunch = () => {
    const action = isPunchedIn ? 'Punch Out' : 'Punch In';
    Alert.alert(action, `Confirm ${action.toLowerCase()}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        onPress: () => {
          if (!user?.id) return;
          setPunching(true);
          const doPunch = (latitude: number | null, longitude: number | null) => {
            punchMutation({
              variables: { input: {
                staffid: user.id, type: isPunchedIn ? 'out' : 'in',
                timestamp: new Date().toISOString(), latitude, longitude, source: 'mobile',
              } },
            })
              .then(() => { refetchOpen?.(); refetchLogs?.(); refetchSummary?.(); })
              .catch((e: any) => Alert.alert('Error', e?.message || 'Punch failed.'))
              .finally(() => setPunching(false));
          };
          try {
            navigator.geolocation.getCurrentPosition(
              pos => doPunch(pos.coords.latitude, pos.coords.longitude),
              ()  => doPunch(null, null),
              { enableHighAccuracy: false, timeout: 8000 },
            );
          } catch { doPunch(null, null); }
        },
      },
    ]);
  };

  const handleSubmitLeave = () => {
    if (!selectedType) { Alert.alert('Leave Type', 'No leave type available.'); return; }
    if (!reason.trim()) { Alert.alert('Reason Required', 'Please enter a reason for your leave.'); return; }
    if (!adminid || !branchid || !user?.id) { Alert.alert('Error', 'Missing account info. Please re-login.'); return; }
    // Only real (server) leave types can be submitted.
    const isRealType = ((typesData as any)?.getLeaveTypes ?? []).some((x: any) => x.id === selectedType.id);
    if (!isRealType) { Alert.alert('Leave Type', 'No leave types configured by admin yet.'); return; }

    Alert.alert(
      'Submit Leave Request',
      `${selectedType.name} · ${fmtDate(fromDate)}${halfDay ? ` (${halfSession} half)` : fromDate.getTime() !== toDate.getTime() ? ` – ${fmtDate(toDate)}` : ''} · ${totalDays} day${totalDays !== 1 ? 's' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              await addLeaveRequestMutation({
                variables: { input: {
                  adminid, branchid, staffid: user.id,
                  leavetypeid: selectedType.id,
                  fromDate: toYMD(fromDate),
                  toDate:   toYMD(halfDay ? fromDate : toDate),
                  totalDays,
                  halfDay,
                  halfDaySession: halfDay ? halfSession : null,
                  reason: reason.trim(),
                } },
              });
              await refetchLeaves?.();
              setShowModal(false);
              resetForm();
              Alert.alert('Submitted!', 'Your leave request has been sent for approval.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not submit leave.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const handleCancelLeave = (id: string) => {
    Alert.alert('Cancel Leave', 'Cancel this request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try { await cancelLeaveRequestMutation({ variables: { id } }); refetchLeaves?.(); }
          catch (e: any) { Alert.alert('Error', e?.message || 'Could not cancel.'); }
        },
      },
    ]);
  };

  const renderLog = ({ item: log }: any) => {
    const meta = STATUS_META[log.status] ?? STATUS_META.absent;
    return (
      <View style={[styles.logCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={[styles.logIconWrap, { backgroundColor: meta.color + '18' }]}>
          <Icon name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.logDate, { color: colors.text }]}>{formatDate(log.date)}</Text>
          <View style={[styles.logBadge, { backgroundColor: meta.color + '18', alignSelf: 'flex-start' }]}>
            <Text style={[styles.logBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        {log.inTime && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.logTime, { color: colors.text }]}>{log.inTime} → {log.outTime ?? '–'}</Text>
            <Text style={[styles.logWork, { color: colors.subText }]}>{formatMinutes(log.totalWorkMinutes)}</Text>
          </View>
        )}
      </View>
    );
  };

  const ListHeader = () => (
    <>
      <Animated.View entering={FadeInUp.duration(400).delay(60)} style={styles.summaryRow}>
        {[
          { icon: 'check-circle-outline',    value: String(present),  label: 'Present',   color: '#22c55e' },
          { icon: 'close-circle-outline',    value: String(absent),   label: 'Absent',    color: '#ef4444' },
          { icon: 'calendar-remove-outline', value: String(leave),    label: 'Leave',     color: '#f59e0b' },
          { icon: 'calendar-month-outline',  value: String(workDays), label: 'Work Days', color: colors.brand },
        ].map(s => (
          <View key={s.label} style={[styles.sumCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.sumIcon, { backgroundColor: s.color + '18' }]}><Icon name={s.icon} size={15} color={s.color} /></View>
            <Text style={[styles.sumValue, { color: colors.text }]}>{s.value}</Text>
            <Text style={[styles.sumLabel, { color: colors.subText }]}>{s.label}</Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(120)} style={[styles.punchCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.punchTitle, { color: colors.text }]}>Today's Attendance</Text>
          <View style={styles.punchRow}>
            <Icon name={isPunchedIn ? 'login' : 'login'} size={14} color={colors.subText} style={{ marginRight: 4 }} />
            <Text style={[styles.punchMeta, { color: colors.subText }]}>
              {isPunchedIn ? `In: ${fmtTime((openData as any)?.getOpenPunch?.timestamp) ?? '—'}` : 'Not punched in'}
            </Text>
            {isPunchedIn && (<><View style={styles.separator} /><View style={[styles.liveDot, { backgroundColor: '#22c55e' }]} /><Text style={[styles.punchMeta, { color: '#22c55e' }]}>Active</Text></>)}
          </View>
        </View>
        <TouchableOpacity style={[styles.punchBtn, { backgroundColor: isPunchedIn ? '#ef444422' : colors.brand }]} onPress={handlePunch} disabled={punching}>
          <Icon name={isPunchedIn ? 'logout' : 'login'} size={18} color={isPunchedIn ? '#ef4444' : '#fff'} />
          <Text style={[styles.punchBtnText, { color: isPunchedIn ? '#ef4444' : '#fff' }]}>{punching ? '…' : (isPunchedIn ? 'Punch Out' : 'Punch In')}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(400).delay(160)}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Leave Requests</Text>
          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.brand }]} onPress={() => { resetForm(); setShowModal(true); }}>
            <Icon name="plus" size={13} color="#fff" />
            <Text style={styles.applyBtnText}>Apply Leave</Text>
          </TouchableOpacity>
        </View>
        {leaves.length === 0 ? (
          <View style={[styles.leaveCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <Text style={[styles.leaveReason, { color: colors.subText }]}>No leave requests yet</Text>
          </View>
        ) : leaves.map((lv: any) => {
          const st = LEAVE_STATUS[lv.status] ?? LEAVE_STATUS.pending;
          const dl = lv.fromDate === lv.toDate
            ? formatDate(lv.fromDate)
            : `${formatDate(lv.fromDate)} – ${formatDate(lv.toDate)}`;
          return (
            <View key={lv.id} style={[styles.leaveCard, { backgroundColor: colors.cardGlass, borderColor: colors.border, borderLeftColor: lv.typeColor, borderLeftWidth: 3 }]}>
              <View style={{ flex: 1 }}>
                <View style={styles.leaveTop}>
                  <Text style={[styles.leaveType, { color: lv.typeColor }]}>{lv.type}</Text>
                  <View style={[styles.leaveBadge, { backgroundColor: st.color + '20' }]}><Text style={[styles.leaveBadgeText, { color: st.color }]}>{st.label}</Text></View>
                </View>
                <Text style={[styles.leaveDates, { color: colors.text }]}>{dl} · {lv.totalDays} day{lv.totalDays !== 1 ? 's' : ''}</Text>
                <Text style={[styles.leaveReason, { color: colors.subText }]} numberOfLines={1}>{lv.reason}</Text>
              </View>
              {lv.status === 'pending' && (
                <TouchableOpacity style={[styles.cancelBtn, { borderColor: '#ef444466' }]} onPress={() => handleCancelLeave(lv.id)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </Animated.View>

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 6, marginBottom: 10 }]}>Attendance Logs</Text>
    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <AppHeader label="Attendance & Leave" />

      <DynamicFlashList
        data={logs}
        renderItem={renderLog}
        estimatedItemSize={72}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={<Text style={[styles.logWork, { color: colors.subText, textAlign: 'center', marginTop: 10 }]}>No attendance logs this month</Text>}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowModal(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKAV}>
          <View style={[styles.modalInner, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Apply Leave</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={20} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Leave Type</Text>
              <View style={styles.typeGrid}>
                {leaveTypes.map((t: any) => {
                  const active = (selectedType?.id) === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeChip, active ? { backgroundColor: t.color, borderColor: t.color } : { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                      onPress={() => { setLeaveTypeId(t.id); setHalfDay(false); }}
                    >
                      <View style={[styles.typeCode, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : t.color + '22' }]}>
                        <Text style={[styles.typeCodeText, { color: active ? '#fff' : t.color }]}>{t.code}</Text>
                      </View>
                      <Text style={[styles.typeName, { color: active ? '#fff' : colors.text }]} numberOfLines={1}>{t.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Date Range</Text>
              <View style={[styles.dateCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                <View style={styles.dateRow}>
                  <Text style={[styles.dateLabel, { color: colors.subText }]}>From</Text>
                  <View style={styles.datePicker}>
                    <TouchableOpacity style={[styles.dateArrow, { backgroundColor: colors.raisedSurface }]} onPress={() => { const n = addDays(fromDate, -1); setFromDate(n); if (n > toDate) setToDate(new Date(n)); }}>
                      <Icon name="chevron-left" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.dateText, { color: colors.text }]}>{fmtDate(fromDate)}</Text>
                    <TouchableOpacity style={[styles.dateArrow, { backgroundColor: colors.raisedSurface }]} onPress={() => { const n = addDays(fromDate, 1); setFromDate(n); if (n > toDate) setToDate(new Date(n)); }}>
                      <Icon name="chevron-right" size={16} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                {!halfDay && (
                  <>
                    <View style={[styles.dateDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.dateRow}>
                      <Text style={[styles.dateLabel, { color: colors.subText }]}>To</Text>
                      <View style={styles.datePicker}>
                        <TouchableOpacity style={[styles.dateArrow, { backgroundColor: colors.raisedSurface }]} onPress={() => { const n = addDays(toDate, -1); if (n >= fromDate) setToDate(n); }}>
                          <Icon name="chevron-left" size={16} color={colors.text} />
                        </TouchableOpacity>
                        <Text style={[styles.dateText, { color: colors.text }]}>{fmtDate(toDate)}</Text>
                        <TouchableOpacity style={[styles.dateArrow, { backgroundColor: colors.raisedSurface }]} onPress={() => setToDate(addDays(toDate, 1))}>
                          <Icon name="chevron-right" size={16} color={colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </View>

              <View style={[styles.totalBadge, { backgroundColor: (selectedType?.color ?? colors.brand) + '18', borderColor: (selectedType?.color ?? colors.brand) + '44' }]}>
                <Icon name="calendar-range" size={13} color={selectedType?.color ?? colors.brand} />
                <Text style={[styles.totalText, { color: selectedType?.color ?? colors.brand }]}>{totalDays} day{totalDays !== 1 ? 's' : ''} leave</Text>
              </View>

              <View style={[styles.halfRow, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.halfLabel, { color: colors.text }]}>Half Day</Text>
                  <Text style={[styles.halfSub, { color: colors.subText }]}>Apply for half a day only</Text>
                </View>
                <Switch
                  value={halfDay}
                  onValueChange={v => { setHalfDay(v); if (v) setToDate(new Date(fromDate)); }}
                  trackColor={{ false: colors.border, true: (selectedType?.color ?? colors.brand) + '88' }}
                  thumbColor={halfDay ? (selectedType?.color ?? colors.brand) : colors.subText}
                />
              </View>
              {halfDay && (
                <View style={styles.sessionRow}>
                  {(['first', 'second'] as const).map(s => {
                    const a = halfSession === s;
                    return (
                      <TouchableOpacity key={s} style={[styles.sessionChip, a ? { backgroundColor: selectedType?.color ?? colors.brand, borderColor: selectedType?.color ?? colors.brand } : { backgroundColor: colors.raisedSurface, borderColor: colors.border }]} onPress={() => setHalfSession(s)}>
                        <Text style={[styles.sessionText, { color: a ? '#fff' : colors.subText }]}>{s === 'first' ? 'First Half' : 'Second Half'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={[styles.fieldLabel, { color: colors.text }]}>Reason</Text>
              <View style={[styles.reasonWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.reasonInput, { color: colors.text }]}
                  placeholder="Describe the reason..."
                  placeholderTextColor={colors.subText}
                  value={reason}
                  onChangeText={setReason}
                  multiline numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: submitting ? colors.border : (selectedType?.color ?? colors.brand) }]}
                onPress={handleSubmitLeave}
                disabled={submitting}
              >
                <Icon name="send-outline" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>{submitting ? 'Submitting…' : 'Submit Request'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  listContent: { paddingHorizontal: 18, paddingBottom: 110 },

  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 14 },
  sumCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 10, alignItems: 'flex-start', shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  sumIcon:  { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  sumValue: { fontSize: 13, fontFamily: FONTS.bold },
  sumLabel: { fontSize: 9, fontFamily: FONTS.regular, marginTop: 1 },

  punchCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 20, shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  punchTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 6 },
  punchRow:   { flexDirection: 'row', alignItems: 'center' },
  punchMeta:  { fontSize: 12, fontFamily: FONTS.semiBold },
  separator:  { width: 1, height: 12, backgroundColor: '#ddd', marginHorizontal: 8 },
  liveDot:    { width: 7, height: 7, borderRadius: 4, marginRight: 4 },
  punchBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  punchBtnText: { fontSize: 13, fontFamily: FONTS.bold },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:  { fontSize: 15, fontFamily: FONTS.bold },
  applyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  applyBtnText:  { fontSize: 12, fontFamily: FONTS.bold, color: '#fff' },

  leaveCard: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10, shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  leaveTop:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  leaveType: { fontSize: 13, fontFamily: FONTS.bold },
  leaveBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  leaveBadgeText:{ fontSize: 10, fontFamily: FONTS.semiBold },
  leaveDates:    { fontSize: 12, fontFamily: FONTS.semiBold, marginBottom: 2 },
  leaveReason:   { fontSize: 11, fontFamily: FONTS.regular },
  cancelBtn:     { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8, alignSelf: 'flex-start' },
  cancelBtnText: { fontSize: 11, fontFamily: FONTS.semiBold, color: '#ef4444' },

  logCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  logIconWrap:  { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  logDate:      { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 4 },
  logBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  logBadgeText: { fontSize: 11, fontFamily: FONTS.semiBold },
  logTime:      { fontSize: 12, fontFamily: FONTS.semiBold },
  logWork:      { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2 },

  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalKAV:      { maxHeight: '90%', width: '100%' },
  modalInner:    { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 20, overflow: 'hidden' },
  modalHandle:   { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  modalTitle:    { fontSize: 17, fontFamily: FONTS.bold },
  modalScroll:   { paddingHorizontal: 20, paddingBottom: 20 },

  fieldLabel: { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 8, marginTop: 4 },
  typeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeChip:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 9, minWidth: '47%', flexShrink: 1 },
  typeCode:   { width: 26, height: 26, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  typeCodeText:{ fontSize: 9, fontFamily: FONTS.bold },
  typeName:   { fontSize: 12, fontFamily: FONTS.semiBold, flex: 1 },

  dateCard:    { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 10 },
  dateRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  dateLabel:   { fontSize: 12, fontFamily: FONTS.semiBold, width: 34 },
  datePicker:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateArrow:   { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  dateText:    { fontSize: 13, fontFamily: FONTS.bold, minWidth: 96, textAlign: 'center' },
  dateDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },

  totalBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  totalText:  { fontSize: 12, fontFamily: FONTS.bold },

  halfRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  halfLabel:  { fontSize: 13, fontFamily: FONTS.semiBold },
  halfSub:    { fontSize: 11, fontFamily: FONTS.regular, marginTop: 2 },
  sessionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  sessionChip:{ flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 1.5, paddingVertical: 9 },
  sessionText:{ fontSize: 12, fontFamily: FONTS.semiBold },

  reasonWrap:   { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16 },
  reasonInput:  { fontSize: 13, fontFamily: FONTS.regular, minHeight: 72 },

  submitBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
  submitBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
});
