import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';
import { UPDATE_SALES_ROUTE } from '../../../../apollo/mutations/staffaccounts';
import type { RootState } from '../../../../store/rootreducer';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Admin panel saves "sun"/"mon"; the app used "Sunday"/"Monday". Normalise to a
// lowercase 3-letter key so both formats compare/match correctly.
const dayKey = (d?: string) => String(d ?? '').trim().slice(0, 3).toLowerCase();

export default function ManagePartyRoute() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();

  const tenant  = useSelector((s: RootState) => s.tenant);
  const adminid = tenant.adminId ?? '';

  const {
    partyId,
    partyName,
    currentRouteId,
    currentRouteName,
    currentDay,
    currentDayWiseAccounts = [] as any[],
    currentSalesmanId      = '',
    availableRoutes        = [] as any[],
  } = route.params ?? {};

  const [selectedDay,   setSelectedDay]   = useState<string>(dayKey(currentDay));
  const [selectedRoute, setSelectedRoute] = useState<string>(currentRouteId);
  const [saving,        setSaving]        = useState(false);
  const [removing,      setRemoving]      = useState(false);

  const [updateRoute] = useMutation(UPDATE_SALES_ROUTE);

  const isMoving     = selectedRoute !== currentRouteId;
  const isDayChanged = selectedDay   !== dayKey(currentDay) && !isMoving;
  const hasChange    = isMoving || isDayChanged;

  const targetRoute  = availableRoutes.find((r: any) => r.id === selectedRoute);

  const handleSave = () => {
    if (!hasChange) return;

    const action = isMoving
      ? `Move "${partyName}" from ${currentRouteName} (${currentDay}) to ${targetRoute?.routename ?? selectedRoute} (${selectedDay})?`
      : `Change "${partyName}" from ${currentDay} to ${selectedDay} on ${currentRouteName}?`;

    Alert.alert('Confirm Change', action, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Save',
        onPress: async () => {
          setSaving(true);
          try {
            if (adminid && currentRouteId) {
              // Remove from current route/day
              const updatedCurrent = removeFromDayWise(currentDayWiseAccounts, currentDay, partyId);
              await updateRoute({
                variables: {
                  id: currentRouteId,
                  input: { adminid, routename: currentRouteName, salesmanid: currentSalesmanId, dayWiseAccounts: updatedCurrent },
                },
              });

              // Add to target route/day
              const destDayWise = isMoving
                ? (targetRoute?.dayWiseAccounts ?? [])
                : updatedCurrent;
              const updatedDest = addToDayWise(destDayWise, selectedDay, partyId);
              await updateRoute({
                variables: {
                  id: selectedRoute,
                  input: {
                    adminid,
                    routename: isMoving ? (targetRoute?.routename ?? currentRouteName) : currentRouteName,
                    salesmanid: isMoving ? (targetRoute?.salesmanid?.id ?? '') : currentSalesmanId,
                    dayWiseAccounts: updatedDest,
                  },
                },
              });
            }
            const msg = isMoving
              ? `${partyName} moved to ${targetRoute?.routename} on ${selectedDay}.`
              : `${partyName} rescheduled to ${selectedDay} on ${currentRouteName}.`;
            Alert.alert('Updated!', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
          } catch {
            Alert.alert('Error', 'Could not update route. Please try again.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove from Route',
      `Remove "${partyName}" from ${currentRouteName} (${currentDay})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              if (adminid && currentRouteId) {
                const updated = removeFromDayWise(currentDayWiseAccounts, currentDay, partyId);
                await updateRoute({
                  variables: {
                    id: currentRouteId,
                    input: { adminid, routename: currentRouteName, salesmanid: currentSalesmanId, dayWiseAccounts: updated },
                  },
                });
              }
              Alert.alert('Removed', `${partyName} has been removed from ${currentRouteName}.`, [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch {
              Alert.alert('Error', 'Could not remove party. Please try again.');
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Manage Party" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Party card */}
        <View style={[styles.partyCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <View style={[styles.partyAvatar, { backgroundColor: colors.brandSoft }]}>
            <Text style={[styles.partyAvatarText, { color: colors.brand }]}>
              {(partyName ?? 'P').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.partyName, { color: colors.text }]}>{partyName}</Text>
            <View style={styles.currentBadgeRow}>
              <View style={[styles.currentBadge, { backgroundColor: colors.brandSoft }]}>
                <Icon name="map-marker-path" size={11} color={colors.brand} />
                <Text style={[styles.currentBadgeText, { color: colors.brand }]}>{currentRouteName}</Text>
              </View>
              <View style={[styles.currentBadge, { backgroundColor: colors.brandSoft }]}>
                <Icon name="calendar-outline" size={11} color={colors.brand} />
                <Text style={[styles.currentBadgeText, { color: colors.brand }]}>{currentDay}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Route section */}
        {availableRoutes.length > 1 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Route</Text>
            <View style={styles.routeChips}>
              {availableRoutes.map((r: any) => {
                const active = selectedRoute === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.routeChip,
                      active
                        ? { backgroundColor: colors.brand,         borderColor: colors.brand }
                        : { backgroundColor: colors.cardGlass,     borderColor: colors.border },
                    ]}
                    onPress={() => {
                      setSelectedRoute(r.id);
                      setSelectedDay('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Icon name="map-marker-path" size={14} color={active ? '#fff' : colors.subText} />
                    <Text style={[styles.routeChipText, { color: active ? '#fff' : colors.subText }]}>
                      {r.routename}
                    </Text>
                    {active && <Icon name="check" size={13} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Day section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Day</Text>
        <View style={styles.dayChips}>
          {DAYS.map(d => {
            const active = selectedDay === dayKey(d);
            return (
              <TouchableOpacity
                key={d}
                style={[
                  styles.dayChip,
                  active
                    ? { backgroundColor: colors.brand,         borderColor: colors.brand }
                    : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                ]}
                onPress={() => setSelectedDay(dayKey(d))}
              >
                <Text style={[styles.dayChipText, { color: active ? '#fff' : colors.subText }]}>
                  {d.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Change summary strip */}
        {hasChange && (
          <View style={[styles.changeStrip, { backgroundColor: colors.brand + '14', borderColor: colors.brand + '44' }]}>
            <Icon name="swap-horizontal" size={14} color={colors.brand} />
            <Text style={[styles.changeStripText, { color: colors.brand }]}>
              {isMoving
                ? `Moving to ${targetRoute?.routename ?? '—'} · ${selectedDay || '—'}`
                : `Rescheduling to ${selectedDay}`
              }
            </Text>
          </View>
        )}

        {/* Save button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: hasChange && !saving ? colors.brand : colors.border },
          ]}
          onPress={handleSave}
          disabled={!hasChange || saving}
          activeOpacity={0.88}
        >
          <Icon name="content-save-outline" size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={[styles.divider, { borderColor: colors.border }]} />

        {/* Remove button */}
        <TouchableOpacity
          style={[styles.removeBtn, { borderColor: '#ef444466', backgroundColor: '#ef44440d' }]}
          onPress={handleRemove}
          disabled={removing}
          activeOpacity={0.85}
        >
          <Icon name="trash-can-outline" size={18} color="#ef4444" />
          <Text style={styles.removeBtnText}>{removing ? 'Removing…' : `Remove from ${currentRouteName}`}</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function removeFromDayWise(dayWiseAccounts: any[], day: string, partyId: string): any[] {
  return dayWiseAccounts.map((d: any) => {
    if (dayKey(d.day) !== dayKey(day)) return { day: d.day, visitorder: d.visitorder ?? 0, accounts: d.accounts };
    return {
      day:        d.day,
      visitorder: d.visitorder ?? 0,
      accounts:   (d.accounts ?? []).filter((id: string) => id !== partyId),
    };
  });
}

function addToDayWise(dayWiseAccounts: any[], day: string, partyId: string): any[] {
  const copy = dayWiseAccounts.map((d: any) => ({
    day: d.day, visitorder: d.visitorder ?? 0,
    accounts: [...(d.accounts ?? [])],
  }));
  const idx = copy.findIndex((d: any) => dayKey(d.day) === dayKey(day));
  if (idx >= 0) {
    if (!copy[idx].accounts.includes(partyId)) copy[idx].accounts.push(partyId);
  } else {
    copy.push({ day, visitorder: 0, accounts: [partyId] });
  }
  return copy;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 40 },

  partyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 14, marginBottom: 20,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  partyAvatar:     { width: 44, height: 44, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  partyAvatarText: { fontSize: 18, fontFamily: FONTS.bold },
  partyName:       { fontSize: 15, fontFamily: FONTS.bold, marginBottom: 8 },
  currentBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  currentBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  currentBadgeText:{ fontSize: 11, fontFamily: FONTS.semiBold },

  sectionTitle: { fontSize: 13, fontFamily: FONTS.bold, marginBottom: 10 },

  routeChips: { flexDirection: 'column', gap: 8, marginBottom: 20 },
  routeChip:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12,
  },
  routeChipText: { flex: 1, fontSize: 13, fontFamily: FONTS.semiBold },

  dayChips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  dayChip:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  dayChipText: { fontSize: 13, fontFamily: FONTS.semiBold },

  changeStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 16,
  },
  changeStripText: { fontSize: 13, fontFamily: FONTS.semiBold },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 18, paddingVertical: 15, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3,
  },
  saveBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },

  divider: { borderTopWidth: StyleSheet.hairlineWidth, marginBottom: 20 },

  removeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 18, borderWidth: 1.5, paddingVertical: 15,
  },
  removeBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: '#ef4444' },
});
