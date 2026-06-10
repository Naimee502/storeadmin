import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import {
  COLORS, FONTS, useTheme,
  partyTypeOptions, regionOptions, stateOptions, TYPE_GROUP_MAP, type Option,
} from '../../../../config';
import { BackHeader } from '../../../../components';
import { GET_ACCOUNT_GROUPS, GET_CHANNELS, GET_ACCOUNTS, GET_ADMIN_SETTINGS } from '../../../../apollo/queries/accounts';
import { GET_STAFF_ACCOUNT } from '../../../../apollo/queries/staffaccounts';
import { ADD_ACCOUNT } from '../../../../apollo/mutations/accounts';
import { UPDATE_SALES_ROUTE } from '../../../../apollo/mutations/staffaccounts';
import type { RootState } from '../../../../store/rootreducer';

// Hoisted so they aren't re-created every render (which would drop keyboard focus).
const Field = ({ label, value, onChange, placeholder, keyboard = 'default', maxLength, icon, autoCapitalize, colors }: any) => (
  <View style={styles.fieldWrap}>
    <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
    <View style={[styles.inputRow, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
      {icon && <Icon name={icon} size={16} color={colors.subText} style={{ marginRight: 8 }} />}
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder={placeholder}
        placeholderTextColor={colors.subText}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize ?? (keyboard === 'default' ? 'words' : 'none')}
        returnKeyType="next"
      />
    </View>
  </View>
);

const SelectField = ({ label, value, placeholder, icon, onPress, colors }: any) => (
  <View style={styles.fieldWrap}>
    <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
    <TouchableOpacity
      style={[styles.inputRow, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && <Icon name={icon} size={16} color={colors.subText} style={{ marginRight: 8 }} />}
      <Text style={[styles.input, { color: value ? colors.text : colors.subText }]} numberOfLines={1}>
        {value || placeholder}
      </Text>
      <Icon name="chevron-down" size={18} color={colors.subText} />
    </TouchableOpacity>
  </View>
);

export default function StaffCreateParty() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();
  const tenant = useSelector((s: RootState) => s.tenant);
  const user   = useSelector((s: RootState) => s.auth.user);
  const adminid = tenant.adminId ?? '';
  const branchid = tenant.branchId ?? '';

  // Optional route context — when the salesman opens this from "Add party to
  // route", the freshly created party is also assigned to that route + day.
  const {
    routeId, routeName, day: routeDay,
    routeSalesmanId = '', allDayWiseAccounts = [] as any[],
  } = route.params ?? {};
  const [updateRoute] = useMutation(UPDATE_SALES_ROUTE);

  const [type,    setType]    = useState('customer');
  const [name,    setName]    = useState('');
  const [mobile,  setMobile]  = useState('');
  const [email,   setEmail]   = useState('');
  const [gstin,   setGstin]   = useState('');
  const [pan,     setPan]     = useState('');
  const [address, setAddress] = useState('');
  const [city,    setCity]    = useState('');
  const [stateV,  setStateV]  = useState<Option | null>(null);
  const [pincode, setPincode] = useState('');
  const [creditlimit, setCreditlimit] = useState('');
  const [openingbalance, setOpeningbalance] = useState('');
  const [openingbalancetype, setOpeningbalancetype] = useState<'debit' | 'credit'>('debit');
  const [channel, setChannel] = useState<Option | null>(null);
  const [region,  setRegion]  = useState<Option>(regionOptions[0]);
  const [parentParty, setParentParty] = useState<Option | null>(null);
  const [latitude,  setLatitude]  = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const captureLocation = () => {
    setLocating(true);
    try {
      navigator.geolocation.getCurrentPosition(
        pos => { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); setLocating(false); },
        () => { setLocating(false); Alert.alert('Location', 'Could not get your location. Enable GPS and try again.'); },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } catch {
      setLocating(false);
      Alert.alert('Location', 'Location is not available on this device.');
    }
  };

  // Picker modal: which field is open
  const [picker, setPicker] = useState<null | 'channel' | 'region' | 'state' | 'parent'>(null);

  const { data: groupData } = useQuery(GET_ACCOUNT_GROUPS, {
    variables: { adminId: adminid }, skip: !adminid,
  });
  const { data: channelData } = useQuery(GET_CHANNELS, {
    variables: { adminId: adminid }, skip: !adminid,
  });
  const { data: settingsData } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid }, skip: !adminid,
  });
  const { data: accountsData } = useQuery(GET_ACCOUNTS, {
    variables: { admin: adminid }, skip: !adminid,
  });
  const manageDownline = (settingsData as any)?.getAdminSettings?.partyManagesDownline === true;

  // Logged-in salesman's assigned channels — the channel dropdown is limited to
  // these so a salesman only adds parties in his own channel(s).
  const { data: staffData } = useQuery(GET_STAFF_ACCOUNT, {
    variables: { id: user?.id, adminId: adminid }, skip: !user?.id || !adminid,
  });
  const myChannelIds: string[] = useMemo(
    () => ((staffData as any)?.getStaffAccountById?.assignedChannels ?? []).map((c: any) => c.id),
    [staffData],
  );
  const isSalesman = (user?.role || '').toLowerCase() === 'salesman';

  const groups: any[] = (groupData as any)?.getAccountGroups ?? [];
  const allChannels = (channelData as any)?.getChannels ?? [];
  // Channel dropdown: salesman → only his assigned channels; others → all.
  const channels: Option[] = useMemo(() => {
    const list = (isSalesman && myChannelIds.length > 0)
      ? allChannels.filter((c: any) => myChannelIds.includes(c.id))
      : allChannels;
    return list.map((c: any) => ({ value: c.id, label: c.channelName }));
  }, [allChannels, isSalesman, myChannelIds]);
  // Mirror admin: Channel & Region only when the channel feature is in use
  // (channels configured). No channels → hide the section.
  const channelsConfigured = (((channelData as any)?.getChannels ?? []).length) > 0;

  // Parent (upline) party options — loaded only AFTER a channel is selected,
  // and only parties whose channel HANDLES the selected channel.
  const parentPartyOptions: Option[] = useMemo(() => {
    const sel = channel?.value;
    if (!sel) return [];
    const allChannels = (channelData as any)?.getChannels ?? [];
    const accounts = (accountsData as any)?.getAccounts ?? [];
    const parentChannelIds = allChannels
      .filter((c: any) => (c.handlesChannels || []).some((h: any) => h.id === sel))
      .map((c: any) => c.id);
    return accounts
      .filter((a: any) => a.channel?.id && parentChannelIds.includes(a.channel.id))
      .map((a: any) => ({ value: a.id, label: a.name }));
  }, [channel, channelData, accountsData]);

  const [addAccount] = useMutation(ADD_ACCOUNT);

  // Resolve account group from party type (name match → category fallback).
  const resolveAccountGroup = useCallback((partyType: string): { id: string; name: string } | null => {
    if (!groups.length) return null;
    const rule = TYPE_GROUP_MAP[partyType];
    if (!rule) return null;
    const byName = groups.find((g: any) => rule.names.some(n => g.accountgroupname.toLowerCase().includes(n)));
    if (byName) return { id: byName.id, name: byName.accountgroupname };
    const byCat = groups.find((g: any) => g.category === rule.category);
    return byCat ? { id: byCat.id, name: byCat.accountgroupname } : null;
  }, [groups]);

  const resolvedGroup = resolveAccountGroup(type);

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Party name is required.'); return; }
    if (!mobile.trim() || mobile.length < 10) { Alert.alert('Required', 'Enter a valid 10-digit mobile number.'); return; }
    if (!resolvedGroup) {
      Alert.alert('Account group missing', 'No matching account group found for this type. Please create a standard account group (e.g. Sundry Debtors) in the admin panel first.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await addAccount({
        variables: {
          input: {
            name: name.trim(),
            type,
            accountgroupid: resolvedGroup.id,
            mobile: mobile.trim(),
            email: email.trim() || null,
            gstnumber: gstin.trim() || null,
            pan: pan.trim() || null,
            address: address.trim() || null,
            city: city.trim() || null,
            state: stateV?.value || null,
            country: 'India',
            pincode: pincode.trim() || null,
            creditlimit: creditlimit ? parseFloat(creditlimit) : 0,
            openingbalance: openingbalance ? parseFloat(openingbalance) : 0,
            openingbalancetype,
            channel: channel?.value || null,
            region: region?.value || 'default',
            assignaccountid: (manageDownline && parentParty?.value) ? parentParty.value : null,
            latitude,
            longitude,
            salesmanid: user?.id || null,
            admin: adminid,
            branchid: branchid || null,
            status: true,
          },
        },
        refetchQueries: [{ query: GET_ACCOUNTS, variables: { admin: adminid } }],
      });

      // If opened from a route, also assign the new party to that route + day.
      const newId = (res as any)?.data?.addAccount?.id;
      if (routeId && routeDay && newId) {
        const existing = (allDayWiseAccounts ?? []).map((d: any) => ({
          day: d.day, visitorder: d.visitorder ?? 0, accounts: [...(d.accounts ?? [])],
        }));
        const idx = existing.findIndex((d: any) => d.day === routeDay);
        if (idx >= 0) { if (!existing[idx].accounts.includes(newId)) existing[idx].accounts.push(newId); }
        else existing.push({ day: routeDay, visitorder: 0, accounts: [newId] });
        await updateRoute({
          variables: { id: routeId, input: { adminid, routename: routeName, salesmanid: routeSalesmanId || user?.id, dayWiseAccounts: existing } },
        });
      }

      Alert.alert(
        'Party Created!',
        routeId ? `${name.trim()} added and assigned to ${routeName} (${routeDay}).` : `${name.trim()} has been added successfully.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create party. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pickerOptions: Option[] =
    picker === 'channel' ? [{ value: '', label: 'None' }, ...channels]
    : picker === 'state' ? stateOptions
    : picker === 'parent' ? [{ value: '', label: 'None' }, ...parentPartyOptions]
    : regionOptions;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

        <BackHeader label="Add New Party" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Party type */}
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Party Type</Text>
          <View style={styles.typeRow}>
            {partyTypeOptions.map(t => {
              const active = type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, active
                    ? { backgroundColor: colors.brand, borderColor: colors.brand }
                    : { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                  onPress={() => {
                    setType(t.value);
                    // Accounting convention: customer = receivable (debit),
                    // vendor = payable (credit). Auto-set, user can override.
                    if (t.value === 'customer') setOpeningbalancetype('debit');
                    else if (t.value === 'vendor') setOpeningbalancetype('credit');
                  }}
                >
                  <Text style={[styles.typeChipText, { color: active ? '#fff' : colors.subText }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Auto-resolved account group */}
          <View style={[styles.groupInfo, { backgroundColor: colors.brandSoft }]}>
            <Icon name="folder-account-outline" size={14} color={colors.brand} />
            <Text style={[styles.groupInfoText, { color: colors.brand }]} numberOfLines={1}>
              {resolvedGroup ? `Account Group: ${resolvedGroup.name}` : 'No matching account group found'}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Basic Info</Text>

          <Field colors={colors} label="Party Name *" value={name}   onChange={setName}   placeholder="e.g. Mehta Traders" icon="store-outline" />
          <Field colors={colors} label="Mobile *"     value={mobile} onChange={setMobile} placeholder="10-digit mobile"     icon="phone-outline" keyboard="phone-pad" maxLength={10} />
          <Field colors={colors} label="Email"        value={email}  onChange={setEmail}  placeholder="email@example.com"   icon="email-outline" keyboard="email-address" />
          <Field colors={colors} label="GSTIN"        value={gstin}  onChange={setGstin}  placeholder="22AAAAA0000A1Z5"     icon="card-account-details-outline" maxLength={15} autoCapitalize="characters" />
          <Field colors={colors} label="PAN"          value={pan}    onChange={setPan}    placeholder="AAAAA0000A"          icon="card-text-outline" maxLength={10} autoCapitalize="characters" />

          {channelsConfigured && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Channel & Region</Text>

              <SelectField colors={colors} label="Channel" value={channel?.label} placeholder="Select channel (optional)" icon="account-network-outline" onPress={() => setPicker('channel')} />
              <SelectField colors={colors} label="Region"  value={region?.label}  placeholder="Select region" icon="map-marker-radius-outline" onPress={() => setPicker('region')} />
              {manageDownline && (
                <SelectField
                  colors={colors}
                  label="Assign Parent Party"
                  value={parentParty?.label}
                  placeholder={channel?.value ? 'Select parent party (optional)' : 'Select a channel first'}
                  icon="file-tree-outline"
                  onPress={() => { if (channel?.value) setPicker('parent'); }}
                />
              )}
            </>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Address & Credit</Text>

          <Field colors={colors} label="Address"  value={address} onChange={setAddress} placeholder="Shop / building / street" icon="home-outline" />
          <Field colors={colors} label="City"     value={city}    onChange={setCity}    placeholder="City"  icon="city-variant-outline" />
          <SelectField colors={colors} label="State" value={stateV?.label} placeholder="Select state" icon="map-outline" onPress={() => setPicker('state')} />
          <Field colors={colors} label="Pin Code" value={pincode} onChange={setPincode} placeholder="6-digit pin code" icon="map-marker-outline" keyboard="numeric" maxLength={6} />

          {/* GPS capture — lets the routes screen show distance & navigation for this party */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Shop Location (GPS)</Text>
            <TouchableOpacity
              style={[styles.inputRow, { backgroundColor: colors.raisedSurface, borderColor: latitude != null ? colors.brand : colors.border }]}
              onPress={captureLocation}
              activeOpacity={0.7}
              disabled={locating}
            >
              <Icon name={locating ? 'loading' : (latitude != null ? 'map-marker-check' : 'crosshairs-gps')} size={16} color={colors.brand} style={{ marginRight: 8 }} />
              <Text style={[styles.input, { color: latitude != null ? colors.text : colors.subText }]} numberOfLines={1}>
                {locating
                  ? 'Getting location…'
                  : latitude != null
                    ? `${latitude.toFixed(5)}, ${longitude?.toFixed(5)}`
                    : 'Tap to capture current location'}
              </Text>
              {latitude != null && !locating && <Icon name="refresh" size={16} color={colors.subText} />}
            </TouchableOpacity>
          </View>
          <Field colors={colors} label="Credit Limit" value={creditlimit} onChange={setCreditlimit} placeholder="0" icon="credit-card-outline" keyboard="numeric" />

          <Field colors={colors} label="Opening Balance" value={openingbalance} onChange={setOpeningbalance} placeholder="0" icon="cash-multiple" keyboard="numeric" />

          {/* Opening balance type — mirrors the admin panel debit/credit selector */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Balance Type</Text>
            <View style={styles.typeRow}>
              {(['debit', 'credit'] as const).map(bt => {
                const active = openingbalancetype === bt;
                return (
                  <TouchableOpacity
                    key={bt}
                    style={[styles.typeChip, active
                      ? { backgroundColor: colors.brand, borderColor: colors.brand }
                      : { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}
                    onPress={() => setOpeningbalancetype(bt)}
                  >
                    <Text style={[styles.typeChipText, { color: active ? '#fff' : colors.subText }]}>
                      {bt === 'debit' ? 'Debit (To Receive)' : 'Credit (To Pay)'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: submitting ? colors.border : colors.brand }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.88}
          >
            <Icon name={submitting ? 'loading' : 'account-plus-outline'} size={20} color="#fff" />
            <Text style={styles.submitBtnText}>{submitting ? 'Creating…' : 'Create Party'}</Text>
          </TouchableOpacity>

        </ScrollView>

        {/* Picker modal */}
        <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPicker(null)}>
            <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {picker === 'channel' ? 'Select Channel' : picker === 'state' ? 'Select State' : picker === 'parent' ? 'Select Parent Party' : 'Select Region'}
              </Text>
              <FlatList
                data={pickerOptions}
                keyExtractor={(item) => item.value || 'none'}
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => {
                  const selected =
                    picker === 'channel' ? channel?.value === item.value
                    : picker === 'state' ? stateV?.value === item.value
                    : picker === 'parent' ? parentParty?.value === item.value
                    : region?.value === item.value;
                  return (
                    <TouchableOpacity
                      style={styles.modalRow}
                      onPress={() => {
                        if (picker === 'channel') { setChannel(item.value ? item : null); setParentParty(null); }
                        else if (picker === 'state') setStateV(item);
                        else if (picker === 'parent') setParentParty(item.value ? item : null);
                        else setRegion(item);
                        setPicker(null);
                      }}
                    >
                      <Text style={[styles.modalRowText, { color: selected ? colors.brand : colors.text }]}>{item.label}</Text>
                      {selected && <Icon name="check" size={18} color={colors.brand} />}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 6 },

  fieldLabel: { fontSize: 12, fontFamily: FONTS.semiBold, marginBottom: 6 },
  fieldWrap:  { marginBottom: 14 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
  },
  input: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, paddingVertical: 0 },

  typeRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
  typeChipText: { fontSize: 12, fontFamily: FONTS.semiBold },

  groupInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  groupInfoText: { fontSize: 12, fontFamily: FONTS.semiBold, flex: 1 },

  divider:      { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  sectionTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 14 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 18, paddingVertical: 16, marginTop: 6, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  submitBtnText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 12 },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.18)' },
  modalRowText: { fontSize: 14, fontFamily: FONTS.semiBold },
});
