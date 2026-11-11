import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  StatusBar, Linking,
} from 'react-native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../../../config';
import { BackHeader } from '../../../components';
import { GET_ADMIN_SETTINGS } from '../../../apollo/queries/accounts';
import type { RootState } from '../../../store/rootreducer';

const FAQS = [
  {
    q: 'How do I place an order?',
    a: 'Go to the Shop tab, browse or search for products, add items to your cart, then tap the cart icon to review and place your order.',
  },
  {
    q: 'How can I track my order status?',
    a: 'Open the Orders tab to see all your orders. Each order shows its current status — Pending, Confirmed, or Cancelled. Tap any order for full details.',
  },
  {
    q: 'What does the Ledger section show?',
    a: 'The Ledger shows your account balance, credit limit, and a complete history of invoices and payments between you and the business.',
  },
  {
    q: 'How do I update my profile information?',
    a: 'Tap the Profile tab. Account details like mobile, email, and GSTIN are managed by the business admin. Contact them directly for updates.',
  },
  {
    q: 'I see demo data — is the app connected to my account?',
    a: 'Demo data is shown when your account hasn\'t been linked yet. Contact your business admin to get your account set up.',
  },
  {
    q: 'How do I sign out?',
    a: 'Go to Profile and scroll to the bottom. Tap "Sign Out" and confirm when prompted.',
  },
];

// Fallback defaults — used whenever the business hasn't configured its own
// support contact details in Business Settings.
const DEFAULT_SUPPORT_EMAIL = 'support@businesssuite.app';
const DEFAULT_SUPPORT_PHONE = '+91 98765 43210';
const DEFAULT_SUPPORT_WHATSAPP = '919876543210';

function buildContact(settings: any) {
  const email = settings?.supportEmail || DEFAULT_SUPPORT_EMAIL;
  const phone = settings?.supportPhone || DEFAULT_SUPPORT_PHONE;
  const whatsapp = settings?.supportWhatsapp || DEFAULT_SUPPORT_WHATSAPP;
  const phoneDigits = phone.replace(/[^0-9+]/g, '');

  return [
    { icon: 'email-outline', color: '#3b82f6', label: 'Email Support', value: email, action: () => Linking.openURL(`mailto:${email}`) },
    { icon: 'phone-outline', color: '#22c55e', label: 'Call Us', value: phone, action: () => Linking.openURL(`tel:${phoneDigits}`) },
    { icon: 'whatsapp', color: '#22c55e', label: 'WhatsApp', value: 'Chat with us', action: () => Linking.openURL(`https://wa.me/${whatsapp}`) },
  ];
}

function FaqItem({ item, colors }: { item: typeof FAQS[0]; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      style={[styles.faqCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
      onPress={() => setOpen(v => !v)}
    >
      <View style={styles.faqTop}>
        <Text style={[styles.faqQ, { color: colors.text }]}>{item.q}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.subText} />
      </View>
      {open && (
        <Text style={[styles.faqA, { color: colors.subText, borderTopColor: colors.border }]}>{item.a}</Text>
      )}
    </Pressable>
  );
}

export default function Support() {
  const { colors, isDark } = useTheme();
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data: settingsData } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const CONTACT = buildContact((settingsData as any)?.getAdminSettings);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Help & Support" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Animated.View entering={FadeInUp.duration(400).delay(60)}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Us</Text>
          </View>
          {CONTACT.map((c) => (
            <Pressable
              key={c.label}
              style={[styles.row, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
              onPress={c.action}
            >
              <View style={[styles.iconChip, { backgroundColor: c.color + '18' }]}>
                <Icon name={c.icon} size={18} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.subText }]}>{c.label}</Text>
                <Text style={[styles.value, { color: colors.text }]}>{c.value}</Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.subText} />
            </Pressable>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(400).delay(140)} style={{ marginTop: 14 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
            <Text style={[styles.countText, { color: colors.subText }]}>{FAQS.length} questions</Text>
          </View>
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} item={faq} colors={colors} />
          ))}
        </Animated.View>

        <View style={styles.versionWrap}>
          <Text style={[styles.versionText, { color: colors.subText }]}>Business Suite v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 40 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 14, fontFamily: FONTS.bold },
  countText:     { fontSize: 12, fontFamily: FONTS.regular },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  iconChip: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  label:    { fontSize: 12, fontFamily: FONTS.regular },
  value:    { fontSize: 13, fontFamily: FONTS.bold, marginTop: 1 },

  faqCard: {
    borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  faqTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqQ:   { flex: 1, fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 19 },
  faqA:   { fontSize: 12, fontFamily: FONTS.regular, lineHeight: 18, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },

  versionWrap: { alignItems: 'center', paddingTop: 28, paddingBottom: 10 },
  versionText: { fontSize: 12, fontFamily: FONTS.regular },
});
