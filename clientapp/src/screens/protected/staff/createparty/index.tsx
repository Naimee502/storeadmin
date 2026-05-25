import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';

const PARTY_TYPES = ['Retailer', 'Wholesaler', 'Distributor', 'Other'];

export default function StaffCreateParty() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();

  const [name,        setName]        = useState('');
  const [mobile,      setMobile]      = useState('');
  const [email,       setEmail]       = useState('');
  const [gstin,       setGstin]       = useState('');
  const [address,     setAddress]     = useState('');
  const [city,        setCity]        = useState('');
  const [state,       setState]       = useState('');
  const [pincode,     setPincode]     = useState('');
  const [partyType,   setPartyType]   = useState(PARTY_TYPES[0]);
  const [submitting,  setSubmitting]  = useState(false);

  const handleSubmit = () => {
    if (!name.trim()) { Alert.alert('Required', 'Party name is required.'); return; }
    if (!mobile.trim() || mobile.length < 10) { Alert.alert('Required', 'Enter a valid 10-digit mobile number.'); return; }

    Alert.alert(
      'Create Party',
      `Create party "${name.trim()}" with mobile ${mobile}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            setSubmitting(true);
            try {
              await new Promise(r => setTimeout(r, 800));
              Alert.alert('Party Created!', `${name.trim()} has been added successfully.`, [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const Field = ({
    label, value, onChange, placeholder, keyboard = 'default', maxLength, icon,
  }: any) => (
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
          autoCapitalize={keyboard === 'default' ? 'words' : 'none'}
          returnKeyType="next"
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

        <BackHeader label="Add New Party" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Party type chips */}
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Party Type</Text>
          <View style={styles.typeRow}>
            {PARTY_TYPES.map(t => {
              const active = partyType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, active
                    ? { backgroundColor: colors.brand, borderColor: colors.brand }
                    : { backgroundColor: colors.raisedSurface, borderColor: colors.border },
                  ]}
                  onPress={() => setPartyType(t)}
                >
                  <Text style={[styles.typeChipText, { color: active ? '#fff' : colors.subText }]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Basic Info</Text>

          <Field label="Party Name *"  value={name}   onChange={setName}   placeholder="e.g. Mehta Traders"  icon="store-outline"   />
          <Field label="Mobile *"      value={mobile} onChange={setMobile} placeholder="10-digit mobile"      icon="phone-outline"   keyboard="phone-pad" maxLength={10} />
          <Field label="Email"         value={email}  onChange={setEmail}  placeholder="email@example.com"    icon="email-outline"   keyboard="email-address" />
          <Field label="GSTIN"         value={gstin}  onChange={setGstin}  placeholder="22AAAAA0000A1Z5"      icon="card-account-details-outline" maxLength={15} />

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Address</Text>

          <Field label="Address"    value={address} onChange={setAddress} placeholder="Shop / building / street"    icon="home-outline"        />
          <Field label="City"       value={city}    onChange={setCity}    placeholder="City"                        icon="city-variant-outline" />
          <Field label="State"      value={state}   onChange={setState}   placeholder="State"                       icon="map-outline"          />
          <Field label="Pin Code"   value={pincode} onChange={setPincode} placeholder="6-digit pin code"            icon="map-marker-outline"   keyboard="numeric" maxLength={6} />

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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 6 },

  fieldLabel: { fontSize: 12, fontFamily: FONTS.semiBold, marginBottom: 6 },
  fieldWrap:  { marginBottom: 14 },
  inputRow:   {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
  },
  input: { flex: 1, fontSize: 14, fontFamily: FONTS.regular, paddingVertical: 0 },

  typeRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  typeChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
  typeChipText: { fontSize: 12, fontFamily: FONTS.semiBold },

  divider:      { height: StyleSheet.hairlineWidth, marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 14 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderRadius: 18, paddingVertical: 16, marginTop: 6, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  submitBtnText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },
});
