import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../../../config';
import { BackHeader } from '../../../components';

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

const CONTACT = [
  { icon: 'email-outline',     label: 'Email Support',  value: 'support@businesssuite.app', action: () => Linking.openURL('mailto:support@businesssuite.app') },
  { icon: 'phone-outline',     label: 'Call Us',        value: '+91 98765 43210',           action: () => Linking.openURL('tel:+919876543210') },
  { icon: 'whatsapp',          label: 'WhatsApp',       value: 'Chat with us',              action: () => Linking.openURL('https://wa.me/919876543210') },
];

function FaqItem({ item, colors }: { item: typeof FAQS[0]; colors: any }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.faqCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
      onPress={() => setOpen(v => !v)}
      activeOpacity={0.82}
    >
      <View style={styles.faqRow}>
        <Text style={[styles.faqQ, { color: colors.text, flex: 1 }]}>{item.q}</Text>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.subText}
          style={{ marginLeft: 8 }}
        />
      </View>
      {open && (
        <Text style={[styles.faqA, { color: colors.subText }]}>{item.a}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function Support() {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Help & Support" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Contact cards */}
        <Animated.View entering={FadeInUp.duration(400).delay(60)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact Us</Text>
          {CONTACT.map((c) => (
            <TouchableOpacity
              key={c.label}
              style={[styles.contactCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}
              onPress={c.action}
              activeOpacity={0.82}
            >
              <View style={[styles.contactIcon, { backgroundColor: colors.brandSoft }]}>
                <Icon name={c.icon} size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactLabel, { color: colors.subText }]}>{c.label}</Text>
                <Text style={[styles.contactValue, { color: colors.text }]}>{c.value}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.subText} />
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* FAQ */}
        <Animated.View entering={FadeInUp.duration(400).delay(140)} style={{ marginTop: 24 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Frequently Asked Questions</Text>
          {FAQS.map((faq, i) => (
            <FaqItem key={i} item={faq} colors={colors} />
          ))}
        </Animated.View>

        {/* App version */}
        <View style={styles.versionWrap}>
          <Text style={[styles.versionText, { color: colors.subText }]}>Business Suite v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { paddingHorizontal: 18, paddingBottom: 40 },

  sectionTitle: { fontSize: 15, fontFamily: FONTS.bold, marginBottom: 12, marginTop: 14 },

  contactCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  contactIcon:  { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  contactLabel: { fontSize: 11, fontFamily: FONTS.regular, marginBottom: 2 },
  contactValue: { fontSize: 14, fontFamily: FONTS.semiBold },

  faqCard: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  faqRow: { flexDirection: 'row', alignItems: 'center' },
  faqQ:   { fontSize: 13, fontFamily: FONTS.semiBold, lineHeight: 19 },
  faqA:   { fontSize: 13, fontFamily: FONTS.regular, lineHeight: 19, marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },

  versionWrap: { alignItems: 'center', paddingTop: 28, paddingBottom: 10 },
  versionText: { fontSize: 12, fontFamily: FONTS.regular },
});
