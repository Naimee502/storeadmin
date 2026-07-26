import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useMutation } from '@apollo/client/react';
import { FONTS, useTheme } from '../config';
import { AppTextInput } from './textinput';
import { EDIT_ACCOUNT } from '../apollo/mutations/accounts';

// Same enum the server's Account model enforces on `state` (and the admin
// panel's Add Account "State" dropdown uses) — must stay in sync with
// server/src/models/accounts/index.ts's `state` enum.
const STATE_OPTIONS = [
  { value: 'andhra_pradesh', label: 'Andhra Pradesh' },
  { value: 'arunachal_pradesh', label: 'Arunachal Pradesh' },
  { value: 'assam', label: 'Assam' },
  { value: 'bihar', label: 'Bihar' },
  { value: 'chhattisgarh', label: 'Chhattisgarh' },
  { value: 'goa', label: 'Goa' },
  { value: 'gujarat', label: 'Gujarat' },
  { value: 'haryana', label: 'Haryana' },
  { value: 'himachal_pradesh', label: 'Himachal Pradesh' },
  { value: 'jharkhand', label: 'Jharkhand' },
  { value: 'karnataka', label: 'Karnataka' },
  { value: 'kerala', label: 'Kerala' },
  { value: 'madhya_pradesh', label: 'Madhya Pradesh' },
  { value: 'maharashtra', label: 'Maharashtra' },
  { value: 'manipur', label: 'Manipur' },
  { value: 'meghalaya', label: 'Meghalaya' },
  { value: 'mizoram', label: 'Mizoram' },
  { value: 'nagaland', label: 'Nagaland' },
  { value: 'odisha', label: 'Odisha' },
  { value: 'punjab', label: 'Punjab' },
  { value: 'rajasthan', label: 'Rajasthan' },
  { value: 'sikkim', label: 'Sikkim' },
  { value: 'tamil_nadu', label: 'Tamil Nadu' },
  { value: 'telangana', label: 'Telangana' },
  { value: 'tripura', label: 'Tripura' },
  { value: 'uttar_pradesh', label: 'Uttar Pradesh' },
  { value: 'uttarakhand', label: 'Uttarakhand' },
  { value: 'west_bengal', label: 'West Bengal' },
  { value: 'andaman_nicobar', label: 'Andaman and Nicobar Islands' },
  { value: 'chandigarh', label: 'Chandigarh' },
  { value: 'dadra_nagar_haveli_daman_diu', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'delhi', label: 'Delhi' },
  { value: 'jammu_kashmir', label: 'Jammu and Kashmir' },
  { value: 'ladakh', label: 'Ladakh' },
  { value: 'lakshadweep', label: 'Lakshadweep' },
  { value: 'puducherry', label: 'Puducherry' },
  { value: 'international', label: 'International' },
];

interface AddressValues {
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface AddressFormProps {
  accountId: string;
  name: string;
  accountGroupId?: string | null;
  initial?: Partial<AddressValues>;
  onSaved: (values: AddressValues) => void;
  submitLabel?: string;
}

// Same field set (Address, City, State, Pincode) the admin panel's Add
// Account "Address Info" section collects — used both to force a delivery
// address before placing an order and to edit it later from Profile.
// Country defaults to "India" server-side same as the admin panel.
export function AddressForm({ accountId, name, accountGroupId, initial, onSaved, submitLabel = 'Save Address' }: AddressFormProps) {
  const { colors } = useTheme();
  const [address, setAddress] = useState(initial?.address || '');
  const [city, setCity] = useState(initial?.city || '');
  const [state, setState] = useState(initial?.state && initial.state !== 'default' ? initial.state : '');
  const [pincode, setPincode] = useState(initial?.pincode || '');
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editAccount, { loading: saving }] = useMutation(EDIT_ACCOUNT);

  const stateLabel = STATE_OPTIONS.find(s => s.value === state)?.label;
  const valid = !!(address.trim() && city.trim() && state && pincode.trim().length >= 4);

  const handleSubmit = async () => {
    if (!valid || !accountGroupId) return;
    setError(null);
    try {
      await editAccount({
        variables: {
          id: accountId,
          input: {
            name,
            accountgroupid: accountGroupId,
            address: address.trim(),
            city: city.trim(),
            state,
            pincode: pincode.trim(),
          },
        },
      });
      onSaved({ address: address.trim(), city: city.trim(), state, pincode: pincode.trim() });
    } catch (err: any) {
      setError(err?.message || "Couldn't save your address. Please try again.");
    }
  };

  return (
    <View>
      <AppTextInput
        label="Address"
        leftIcon="map-marker-outline"
        placeholder="House / street / area"
        value={address}
        onChangeText={setAddress}
        autoCapitalize="sentences"
      />
      <AppTextInput
        label="City"
        leftIcon="city-variant-outline"
        placeholder="City"
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
      />

      <Text style={[styles.label, { color: colors.text }]}>State</Text>
      <TouchableOpacity
        style={[styles.selectRow, { borderColor: colors.border, backgroundColor: colors.secondary }]}
        onPress={() => setStatePickerOpen(true)}
        activeOpacity={0.7}
      >
        <Icon name="map-outline" size={18} color={colors.subText} style={{ marginRight: 10 }} />
        <Text style={[styles.selectText, { color: stateLabel ? colors.text : colors.placeholder }]}>
          {stateLabel || 'Select State'}
        </Text>
        <Icon name="chevron-down" size={18} color={colors.subText} />
      </TouchableOpacity>

      <AppTextInput
        label="Pincode"
        leftIcon="pound"
        placeholder="380001"
        value={pincode}
        onChangeText={t => setPincode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
      />

      {!!error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: !valid || saving || !accountGroupId ? colors.border : colors.brand }]}
        onPress={handleSubmit}
        disabled={!valid || saving || !accountGroupId}
        activeOpacity={0.85}
      >
        <Text style={styles.submitBtnText}>{saving ? 'Saving…' : submitLabel}</Text>
      </TouchableOpacity>

      <Modal visible={statePickerOpen} transparent animationType="slide" onRequestClose={() => setStatePickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setStatePickerOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.cardGlass }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Select State</Text>
            <FlatList
              data={STATE_OPTIONS}
              keyExtractor={item => item.value}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.sheetItem}
                  onPress={() => {
                    setState(item.value);
                    setStatePickerOpen(false);
                  }}
                >
                  <Text
                    style={{
                      color: item.value === state ? colors.brand : colors.text,
                      fontFamily: item.value === state ? FONTS.bold : FONTS.regular,
                      fontSize: 14,
                    }}
                  >
                    {item.label}
                  </Text>
                  {item.value === state && <Icon name="check" size={16} color={colors.brand} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: FONTS.medium, marginBottom: 6, marginLeft: 6 },
  selectRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, minHeight: 46, borderRadius: 14,
    paddingHorizontal: 14, marginBottom: 12,
  },
  selectText: { flex: 1, fontFamily: FONTS.regular, fontSize: 14 },
  error: { fontSize: 12, fontFamily: FONTS.regular, marginBottom: 10, marginLeft: 6 },
  submitBtn: { borderRadius: 14, height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  submitBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  sheetTitle: { fontSize: 16, fontFamily: FONTS.bold, marginBottom: 10 },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
});
