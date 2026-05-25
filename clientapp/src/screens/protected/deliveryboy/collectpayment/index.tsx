import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Alert,
  TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, FONTS, useTheme } from '../../../../config';
import { BackHeader } from '../../../../components';

type PaymentMode = 'cash' | 'upi' | 'cheque';

const MODES: { id: PaymentMode; label: string; icon: string; color: string }[] = [
  { id: 'cash',   label: 'Cash',   icon: 'cash',        color: '#22c55e' },
  { id: 'upi',    label: 'UPI',    icon: 'qrcode-scan', color: '#6366f1' },
  { id: 'cheque', label: 'Cheque', icon: 'checkbook',   color: '#f59e0b' },
];

export default function DeliveryCollectPayment() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { colors, isDark } = useTheme();

  const { orderId, orderNum, partyName, amount = 0 } = route.params ?? {};

  const [mode,       setMode]       = useState<PaymentMode>('cash');
  const [inputAmt,   setInputAmt]   = useState(amount > 0 ? String(amount) : '');
  const [reference,  setReference]  = useState('');
  const [notes,      setNotes]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedMode = MODES.find(m => m.id === mode)!;
  const parsedAmount = parseFloat(inputAmt) || 0;

  const handleSubmit = () => {
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid collection amount.');
      return;
    }
    if ((mode === 'upi' || mode === 'cheque') && !reference.trim()) {
      Alert.alert('Reference Required', mode === 'upi' ? 'Please enter the UPI transaction ID.' : 'Please enter the cheque number.');
      return;
    }
    Alert.alert(
      'Confirm Collection',
      `Record ${selectedMode.label} payment of ₹${parsedAmount.toLocaleString('en-IN')} from ${partyName} for ${orderNum}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setSubmitting(true);
            try {
              await new Promise(r => setTimeout(r, 800));
              Alert.alert(
                'Payment Recorded!',
                `₹${parsedAmount.toLocaleString('en-IN')} via ${selectedMode.label} collected from ${partyName}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

        <BackHeader label="Collect Payment" />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Order card */}
          <View style={[styles.orderCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={[styles.orderIconWrap, { backgroundColor: colors.brandSoft }]}>
              <Icon name="truck-delivery-outline" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.orderNum, { color: colors.text }]}>{orderNum}</Text>
              <Text style={[styles.partyName, { color: colors.subText }]}>{partyName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.orderAmt, { color: colors.text }]}>₹{amount.toLocaleString('en-IN')}</Text>
              <Text style={[styles.orderAmtLabel, { color: colors.subText }]}>Order value</Text>
            </View>
          </View>

          {/* Use full amount button */}
          {amount > 0 && parsedAmount !== amount && (
            <TouchableOpacity
              style={[styles.useFullBtn, { backgroundColor: colors.brandSoft, borderColor: colors.brand + '44' }]}
              onPress={() => setInputAmt(String(amount))}
            >
              <Icon name="lightning-bolt" size={14} color={colors.brand} />
              <Text style={[styles.useFullText, { color: colors.brand }]}>
                Use full amount  ₹{amount.toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Payment mode */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Payment Mode</Text>
          <View style={styles.modeRow}>
            {MODES.map(m => {
              const active = mode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeCard, {
                    backgroundColor: active ? m.color + '18' : colors.cardGlass,
                    borderColor:     active ? m.color         : colors.border,
                  }]}
                  onPress={() => { setMode(m.id); setReference(''); }}
                  activeOpacity={0.8}
                >
                  <Icon name={m.icon} size={22} color={active ? m.color : colors.subText} />
                  <Text style={[styles.modeLabel, { color: active ? m.color : colors.subText }]}>{m.label}</Text>
                  {active && (
                    <View style={[styles.modeCheck, { backgroundColor: m.color }]}>
                      <Icon name="check" size={9} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Amount */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Amount (₹)</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
            <Text style={[styles.currencySymbol, { color: colors.brand }]}>₹</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.subText}
              value={inputAmt}
              onChangeText={setInputAmt}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          {/* Reference for UPI / Cheque */}
          {(mode === 'upi' || mode === 'cheque') && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                {mode === 'upi' ? 'UPI Transaction ID' : 'Cheque Number'}
              </Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
                <Icon name={mode === 'upi' ? 'identifier' : 'numeric'} size={18} color={colors.subText} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder={mode === 'upi' ? 'e.g. TXN123456789' : 'e.g. 000123'}
                  placeholderTextColor={colors.subText}
                  value={reference}
                  onChangeText={setReference}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />
              </View>
            </>
          )}

          {/* Notes */}
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Notes (optional)</Text>
          <View style={[styles.inputWrap, styles.notesWrap, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, styles.notesInput, { color: colors.text }]}
              placeholder="Add a note..."
              placeholderTextColor={colors.subText}
              value={notes}
              onChangeText={setNotes}
              multiline numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Summary strip */}
          {parsedAmount > 0 && (
            <View style={[styles.summaryStrip, { backgroundColor: selectedMode.color + '14', borderColor: selectedMode.color + '44' }]}>
              <Icon name={selectedMode.icon} size={16} color={selectedMode.color} />
              <Text style={[styles.summaryText, { color: selectedMode.color }]}>
                Collecting{' '}
                <Text style={{ fontFamily: FONTS.bold }}>₹{parsedAmount.toLocaleString('en-IN')}</Text>
                {' '}via {selectedMode.label}
              </Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: submitting ? colors.border : selectedMode.color }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.88}
          >
            {submitting ? (
              <Text style={styles.submitBtnText}>Recording…</Text>
            ) : (
              <>
                <Icon name="check-circle-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {parsedAmount > 0 ? `Record ₹${parsedAmount.toLocaleString('en-IN')}` : 'Record Payment'}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 40 },

  orderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 14, marginBottom: 12,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  orderIconWrap:  { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  orderNum:       { fontSize: 14, fontFamily: FONTS.bold, marginBottom: 2 },
  partyName:      { fontSize: 12, fontFamily: FONTS.regular },
  orderAmt:       { fontSize: 15, fontFamily: FONTS.bold },
  orderAmtLabel:  { fontSize: 10, fontFamily: FONTS.regular, marginTop: 2 },

  useFullBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 18,
  },
  useFullText: { fontSize: 13, fontFamily: FONTS.semiBold },

  sectionLabel: { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 10 },

  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeCard: {
    flex: 1, alignItems: 'center', gap: 6,
    borderRadius: 16, borderWidth: 1.5, paddingVertical: 14,
    position: 'relative',
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  modeLabel: { fontSize: 12, fontFamily: FONTS.semiBold },
  modeCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 18,
  },
  notesWrap:      { paddingVertical: 10, alignItems: 'flex-start' },
  currencySymbol: { fontSize: 20, fontFamily: FONTS.bold, marginRight: 6 },
  amountInput:    { flex: 1, fontSize: 26, fontFamily: FONTS.bold, paddingVertical: 10 },
  textInput:      { flex: 1, fontSize: 14, fontFamily: FONTS.regular, paddingVertical: 8 },
  notesInput:     { minHeight: 72 },

  summaryStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 18,
  },
  summaryText: { fontSize: 13, fontFamily: FONTS.regular },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 18, paddingVertical: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  submitBtnText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },
});
