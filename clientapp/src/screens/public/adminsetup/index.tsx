import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDispatch } from 'react-redux';
import { apolloClient } from '../../../apollo/client';
import { COLORS, FONTS, useTheme } from '../../../config';
import { useAuth } from '../../../navigation';
import { setTenant } from '../../../store/slices';
import { GET_ADMIN_BY_CODE } from '../../../apollo/queries/admin';
import { GET_BRANCHES } from '../../../apollo/queries/branches';
import { GET_ADMIN_SETTINGS } from '../../../apollo/queries/accounts';
import { AppLoader } from '../../../components';

export default function AdminSetup() {
  const { activateBusiness } = useAuth();
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();

  const [code, setCode] = useState('');
  const [mobile, setMobile] = useState('');
  const [errors, setErrors] = useState<{ code?: string; mobile?: string }>({});
  const [preview, setPreview] = useState<{ companyName: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const mobileRef = useRef<TextInput>(null);

  // Last-10-digits compare so stored formats like "+91 98765 43210" or
  // "919876543210" still match a plain 10-digit entry.
  const last10 = (v: string) => (v || '').replace(/\D/g, '').slice(-10);

  const handleActivate = async () => {
    // Admin code like "#ADM0001" — accept with/without "#", any case
    const raw = code.trim().toUpperCase();
    const mobileDigits = mobile.replace(/\D/g, '');
    const nextErrors: { code?: string; mobile?: string } = {};
    if (!raw) nextErrors.code = 'Please enter your business code.';
    if (mobileDigits.length !== 10) nextErrors.mobile = 'Enter a valid 10-digit mobile number.';
    if (nextErrors.code || nextErrors.mobile) { setErrors(nextErrors); return; }

    const normalized = raw.startsWith('#') ? raw : `#${raw}`;
    setErrors({});
    setPreview(null);
    setLoading(true);

    try {
      const { data } = await apolloClient.query({
        query: GET_ADMIN_BY_CODE,
        variables: { admincode: normalized },
        fetchPolicy: 'network-only',
      });

      const admin = (data as any)?.getAdminByCode;
      console.log('Business Detail:', JSON.stringify(admin));

      if (!admin) {
        setErrors({ code: 'Business code not found. Please check and try again.' });
        setLoading(false);
        return;
      }

      // Both fields must match the SAME business — code alone is not enough.
      if (last10(admin.mobile) !== mobileDigits) {
        setErrors({ mobile: 'Mobile number does not match this business code.' });
        setLoading(false);
        return;
      }

      const companyName = admin.companyName || 'My Business';

      let branchId: string | null = null;
      try {
        const { data: branchData } = await apolloClient.query({
          query: GET_BRANCHES,
          variables: { adminId: admin.id },
          fetchPolicy: 'network-only',
        });
        const branches: any[] = (branchData as any)?.getBranches ?? [];
        branchId = (branches.find((b: any) => b.status !== false) ?? branches[0])?.id ?? null;
      } catch { /* branch fetch optional */ }

      // Fetched here so the login screen — the very next thing shown — already
      // has the business's logo, instead of drawing the generic badge for a
      // frame while its own settings query lands.
      let logoUrl: string | null = null;
      let primaryColor: string | null = null;
      try {
        const { data: settingsData } = await apolloClient.query({
          query: GET_ADMIN_SETTINGS,
          variables: { adminid: admin.id },
          fetchPolicy: 'network-only',
        });
        logoUrl = (settingsData as any)?.getAdminSettings?.brandLogo || null;
        primaryColor = (settingsData as any)?.getAdminSettings?.themeBrandColor || null;
      } catch { /* branding is decoration; activation must not fail over it */ }

      dispatch(setTenant({
        adminId: admin.id,
        companyName,
        logoUrl,
        primaryColor,
        tagline: null,
        branchId,
        businessCode: normalized,
      }));

      setPreview({ companyName });
      await new Promise<void>(resolve => setTimeout(resolve, 800));
      activateBusiness();
    } catch (err: any) {
      const isNetwork = err?.networkError || err?.message?.toLowerCase().includes('network') || err?.message?.toLowerCase().includes('fetch');
      setErrors({ code: isNetwork
        ? 'Cannot connect to server. Make sure the server is running and your device is on the same network.'
        : 'Business code not found. Please check and try again.'
      });
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />

      <AppLoader visible={loading} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Icon badge */}
            <Animated.View entering={FadeInDown.duration(700).delay(100)} style={styles.iconWrap}>
              <LinearGradient
                colors={[colors.raisedSurface, colors.brandSoft]}
                style={[styles.iconBadge, { borderColor: colors.border }]}
              >
                <Icon name="shield-key-outline" size={54} color={colors.brand} />
              </LinearGradient>
            </Animated.View>

            {/* Heading */}
            <Animated.View entering={FadeInDown.duration(700).delay(220)} style={styles.headingWrap}>
              <Text style={[styles.title, { color: colors.text }]}>Activate Business</Text>
              <Text style={[styles.subtitle, { color: colors.subText }]}>
                Enter the business code (e.g. #ADM0001) and the registered mobile number provided by your administrator to link this app to your business account.
              </Text>
            </Animated.View>

            {/* Input card */}
            <Animated.View entering={FadeInUp.duration(700).delay(340)} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Business Code</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.raisedSurface, borderColor: errors.code ? '#ef4444' : colors.border }]}>
                <Icon name="briefcase-outline" size={20} color={colors.brand} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="#ADM0001"
                  placeholderTextColor={colors.placeholder}
                  value={code}
                  onChangeText={t => { setCode(t); setErrors(e => ({ ...e, code: undefined })); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => mobileRef.current?.focus()}
                />
              </View>
              {!!errors.code && (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={14} color="#ef4444" />
                  <Text style={styles.errorText}>{errors.code}</Text>
                </View>
              )}

              <Text style={[styles.inputLabel, { color: colors.subText, marginTop: 16 }]}>Registered Mobile Number</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.raisedSurface, borderColor: errors.mobile ? '#ef4444' : colors.border }]}>
                <Icon name="phone-outline" size={20} color={colors.brand} style={styles.inputIcon} />
                <TextInput
                  ref={mobileRef}
                  style={[styles.input, { color: colors.text, letterSpacing: 0 }]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={colors.placeholder}
                  value={mobile}
                  onChangeText={t => { setMobile(t.replace(/\D/g, '').slice(0, 10)); setErrors(e => ({ ...e, mobile: undefined })); }}
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={handleActivate}
                />
              </View>
              {!!errors.mobile && (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={14} color="#ef4444" />
                  <Text style={styles.errorText}>{errors.mobile}</Text>
                </View>
              )}

              {preview && (
                <Animated.View entering={FadeInDown.duration(400)} style={[styles.previewRow, { backgroundColor: colors.brandSoft, borderColor: colors.brand }]}>
                  <Icon name="check-circle-outline" size={18} color={colors.brand} />
                  <Text style={[styles.previewText, { color: colors.brand }]}>{preview.companyName}</Text>
                </Animated.View>
              )}

              <TouchableOpacity
                style={styles.button}
                onPress={handleActivate}
                activeOpacity={0.85}
                disabled={loading}
              >
                <LinearGradient
                  colors={[colors.brandLight, colors.brandDark]}
                  style={styles.buttonGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.buttonText}>Activate</Text>
                  <Icon name="arrow-right" size={18} color={COLORS.light.onBrand} style={{ marginLeft: 6 }} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(600).delay(500)} style={styles.helpWrap}>
              <Icon name="information-outline" size={15} color={colors.subText} />
              <Text style={[styles.helpText, { color: colors.subText }]}>
                {' '}This is a one-time setup. Contact support if you don't have a code.
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40,
    alignItems: 'center', justifyContent: 'flex-start',
  },
  glow: { position: 'absolute', width: '120%', height: 190, opacity: 1 },
  glowOne: { backgroundColor: COLORS.light.brandSoft, top: -72, right: -34, borderBottomLeftRadius: 120, transform: [{ rotate: '-7deg' }] },
  glowTwo: { backgroundColor: COLORS.light.warmSoft, bottom: 86, left: -48, height: 150, borderTopRightRadius: 110, transform: [{ rotate: '-8deg' }] },
  iconWrap: { marginBottom: 28, marginTop: 20 },
  iconBadge: {
    width: 110, height: 110, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5,
    shadowColor: COLORS.light.brand, shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14, shadowRadius: 24, elevation: 8,
  },
  headingWrap: { alignItems: 'center', marginBottom: 32, paddingHorizontal: 8 },
  title: { fontSize: 30, fontFamily: FONTS.bold, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, fontFamily: FONTS.regular, textAlign: 'center', lineHeight: 22 },
  card: {
    width: '100%', borderRadius: 28, borderWidth: 1, padding: 20,
    shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08, shadowRadius: 24, elevation: 6,
  },
  inputLabel: { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 8, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 14, height: 52, marginBottom: 4,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, fontFamily: FONTS.bold, letterSpacing: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 2 },
  errorText: { fontSize: 13, fontFamily: FONTS.medium, color: '#ef4444', marginLeft: 4 },
  previewRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 12,
  },
  previewText: { fontSize: 15, fontFamily: FONTS.bold, marginLeft: 8 },
  button: { marginTop: 18, borderRadius: 16, overflow: 'hidden' },
  buttonGrad: { height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.light.onBrand },
  helpWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingHorizontal: 8 },
  helpText: { fontSize: 13, fontFamily: FONTS.regular, flexShrink: 1, lineHeight: 18 },
});
