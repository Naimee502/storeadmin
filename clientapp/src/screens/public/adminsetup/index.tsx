import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../../../config';
import { useAuth } from '../../../navigation';
import { useDispatch } from 'react-redux';
import { setTenant } from '../../../store/slices';
import { API_CONFIG } from '../../../config';

const GRAPHQL_QUERY = `
  query GetAdminBranding($adminid: String!) {
    getAdminBranding(adminid: $adminid) {
      id
      companyName
      logoUrl
      primaryColor
      tagline
    }
  }
`;

export default function AdminSetup() {
  const { activateBusiness } = useAuth();
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();

  const [code, setCode] = useState('69ed1cf2e4765b57de87d427');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ companyName: string } | null>(null);

  const handleActivate = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Please enter your business code.'); return; }

    setLoading(true);
    setError('');
    setPreview(null);

    try {
      const res = await fetch(API_CONFIG.GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: GRAPHQL_QUERY, variables: { adminid: trimmed } }),
      });

      const json = await res.json();
      const data = json?.data?.getAdminBranding;

      if (json.errors?.length || !data) {
        dispatch(setTenant({
          adminId: trimmed,
          companyName: 'My Business',
          logoUrl: null,
          primaryColor: null,
          tagline: null,
        }));
      } else {
        dispatch(setTenant({
          adminId: trimmed,
          companyName: data.companyName || 'My Business',
          logoUrl: data.logoUrl || null,
          primaryColor: data.primaryColor || null,
          tagline: data.tagline || null,
        }));
        setPreview({ companyName: data.companyName });
      }

      // Brief preview pause so user sees success, then transition
      await new Promise<void>(resolve => setTimeout(() => resolve(), preview ? 900 : 0));
      activateBusiness();

    } catch {
      // Network error: still activate (server may be unreachable in dev)
      dispatch(setTenant({
        adminId: trimmed,
        companyName: 'My Business',
        logoUrl: null,
        primaryColor: null,
        tagline: null,
      }));
      activateBusiness();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
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
                Enter the unique code provided by your administrator to link this app to your business account.
              </Text>
            </Animated.View>

            {/* Input card */}
            <Animated.View entering={FadeInUp.duration(700).delay(340)} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Business Code</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.raisedSurface, borderColor: error ? '#ef4444' : colors.border }]}>
                <Icon name="briefcase-outline" size={20} color={colors.brand} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="e.g. ARSI001"
                  placeholderTextColor={colors.placeholder}
                  value={code}
                  onChangeText={t => { setCode(t.toUpperCase()); setError(''); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleActivate}
                />
              </View>
              {!!error && (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={14} color="#ef4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Success preview */}
              {preview && (
                <Animated.View entering={FadeInDown.duration(400)} style={[styles.previewRow, { backgroundColor: colors.brandSoft, borderColor: colors.brand }]}>
                  <Icon name="check-circle-outline" size={18} color={colors.brand} />
                  <Text style={[styles.previewText, { color: colors.brand }]}>{preview.companyName}</Text>
                </Animated.View>
              )}

              {/* Activate button */}
              <TouchableOpacity
                style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
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
                  {loading
                    ? <ActivityIndicator color={COLORS.light.onBrand} size="small" />
                    : <>
                      <Text style={styles.buttonText}>Activate</Text>
                      <Icon name="arrow-right" size={18} color={COLORS.light.onBrand} style={{ marginLeft: 6 }} />
                    </>
                  }
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Help text */}
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: { position: 'absolute', width: '120%', height: 190, opacity: 1 },
  glowOne: { backgroundColor: COLORS.light.brandSoft, top: -72, right: -34, borderBottomLeftRadius: 120, transform: [{ rotate: '-7deg' }] },
  glowTwo: { backgroundColor: COLORS.light.warmSoft, bottom: 86, left: -48, height: 150, borderTopRightRadius: 110, transform: [{ rotate: '-8deg' }] },
  iconWrap: { marginBottom: 28, marginTop: 20 },
  iconBadge: {
    width: 110, height: 110, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: COLORS.light.brand,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14, shadowRadius: 24, elevation: 8,
  },
  headingWrap: { alignItems: 'center', marginBottom: 32, paddingHorizontal: 8 },
  title: { fontSize: 30, fontFamily: FONTS.bold, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, fontFamily: FONTS.regular, textAlign: 'center', lineHeight: 22 },
  card: {
    width: '100%', borderRadius: 28, borderWidth: 1,
    padding: 20,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6,
  },
  inputLabel: { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 8, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 14, height: 52, marginBottom: 4,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 18, fontFamily: FONTS.bold, letterSpacing: 2 },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 2 },
  errorText: { fontSize: 13, fontFamily: FONTS.medium, color: '#ef4444', marginLeft: 4 },
  previewRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 12,
  },
  previewText: { fontSize: 15, fontFamily: FONTS.bold, marginLeft: 8 },
  button: { marginTop: 18, borderRadius: 16, overflow: 'hidden' },
  buttonGrad: {
    height: 52, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center',
  },
  buttonText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.light.onBrand },
  helpWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 24, paddingHorizontal: 8,
  },
  helpText: { fontSize: 13, fontFamily: FONTS.regular, flexShrink: 1, lineHeight: 18 },
});
