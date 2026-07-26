import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ScrollView, StatusBar, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp, FadeInDown, FadeInRight } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../config';
import { useAuth } from '../../../navigation';
import { useDispatch, useSelector } from 'react-redux';
import { setCredentials, setBranch } from '../../../store/slices';
import { useUI } from '../../../utils';
import { apolloClient } from '../../../apollo/client';
import { SEND_OTP, REGISTER_ACCOUNT } from '../../../apollo/mutations/accounts';
import { LOGIN_STAFF } from '../../../apollo/mutations/staffaccounts';
import type { RootState } from '../../../store/rootreducer';

export default function Login({ navigation }: any) {
  const { signIn } = useAuth();
  const { colors, isDark } = useTheme();
  const dispatch = useDispatch();
  const { showLoader, showToast } = useUI();
  const adminId = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const branchId = useSelector((s: RootState) => s.tenant.branchId);

  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isStaffMode, setIsStaffMode] = useState(false);
  // Entering a mobile number sendOTP doesn't recognize drops straight into
  // this inline registration form (Name + Email only — Party Type/Sales
  // Channel/Ledger are all set automatically server-side by
  // registerAccount), instead of just showing "not registered" as an error.
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ mobile?: string; password?: string; name?: string }>({});
  const [mobileFocused, setMobileFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const mobileRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  const validateMobile = () => {
    if (!mobile.trim() || mobile.replace(/\D/g, '').length < 10) {
      setErrors(e => ({ ...e, mobile: 'Enter a valid 10-digit mobile number' }));
      return false;
    }
    return true;
  };

  const handleSendOTP = async () => {
    if (!validateMobile()) return;
    showLoader(true);
    try {
      const { data } = await apolloClient.mutate({
        mutation: SEND_OTP,
        variables: { adminId, mobile: mobile.trim() },
      });
      if (data?.sendOTP?.success) {
        navigation.navigate('OTPVerification', {
          mobile: mobile.trim(),
          adminId,
          autoOtp: data.sendOTP.otp ?? '',
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not send OTP. Try again.';
      if (msg.toLowerCase().includes('not registered')) {
        setIsRegisterMode(true);
        setErrors({});
        setTimeout(() => nameRef.current?.focus(), 350);
        return;
      }
      setErrors(e => ({ ...e, mobile: msg }));
    } finally {
      showLoader(false);
    }
  };

  const handleRegister = async () => {
    if (!validateMobile()) return;
    if (!name.trim()) {
      setErrors(e => ({ ...e, name: 'Enter your name' }));
      return;
    }
    showLoader(true);
    try {
      const { data } = await apolloClient.mutate({
        mutation: REGISTER_ACCOUNT,
        variables: { adminId, name: name.trim(), mobile: mobile.trim(), email: email.trim() || null },
      });
      if (data?.registerAccount?.success) {
        navigation.navigate('OTPVerification', {
          mobile: mobile.trim(),
          adminId,
          autoOtp: data.registerAccount.otp ?? '',
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not create your account. Try again.';
      setErrors(e => ({ ...e, mobile: msg }));
    } finally {
      showLoader(false);
    }
  };

  const exitRegisterMode = () => {
    setIsRegisterMode(false);
    setName('');
    setEmail('');
    setErrors({});
  };

  const handleStaffLogin = async () => {
    if (!validateMobile()) return;
    if (!password.trim() || password.length < 4) {
      setErrors(e => ({ ...e, password: 'Enter your password' }));
      return;
    }
    showLoader(true);
    try {
      const { data } = await apolloClient.mutate({
        mutation: LOGIN_STAFF,
        variables: { adminId, mobile: mobile.trim(), password: password.trim() },
      });

      const { accessToken, staff } = data.loginStaffByMobile;
      console.log('Staff login:', staff);

      dispatch(setCredentials({
        user: {
          id: staff.id,
          name: staff.name,
          mobile: staff.mobile,
          role: staff.role,
          adminId: staff.admin?.id ?? adminId,
          email: staff.email,
        },
        token: accessToken,
      }));

      // Pin the active branch to the one assigned to this staff member.
      // Sales orders require a valid branchid; without this the tenant
      // branch stays whatever admin-setup picked (often null) and order
      // placement fails with an ObjectId cast error on the server.
      dispatch(setBranch({
        adminId: staff.admin?.id ?? adminId,
        branchId: staff.branchid?.id ?? branchId ?? null,
      }));

      await signIn();
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Try again.';
      if (msg.toLowerCase().includes('password')) {
        setErrors(e => ({ ...e, password: msg }));
      } else {
        setErrors(e => ({ ...e, mobile: msg }));
      }
    } finally {
      showLoader(false);
    }
  };

  const toggleStaffMode = () => {
    setIsStaffMode(v => !v);
    setErrors({});
    if (!isStaffMode) {
      // Entering staff mode → focus the MOBILE field first (you fill mobile, then password).
      setTimeout(() => mobileRef.current?.focus(), 350);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero */}
            <Animated.View entering={FadeInUp.duration(800).delay(80)} style={styles.hero}>
              <LinearGradient
                colors={[colors.raisedSurface, colors.brandSoft]}
                style={[styles.iconBadge, { borderColor: colors.border, shadowColor: colors.brand }]}
              >
                <Icon name="store-outline" size={48} color={colors.brand} />
              </LinearGradient>
              <Text style={[styles.eyebrow, { color: colors.brand }]}>Business Suite</Text>
              <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
              <Text style={[styles.subtitle, { color: colors.subText }]}>
                {isRegisterMode
                  ? "This number isn't registered yet — tell us a bit about yourself to get set up."
                  : isStaffMode
                  ? 'Enter your mobile number and password to sign in.'
                  : 'Enter your mobile number to receive a one-time passcode.'}
              </Text>
            </Animated.View>

            {/* Form card */}
            <Animated.View entering={FadeInUp.duration(800).delay(240)} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>

              {/* Mobile input */}
              <Text style={[styles.label, { color: colors.subText }]}>Mobile Number</Text>
              <View style={[styles.inputRow, {
                backgroundColor: colors.raisedSurface,
                borderColor: errors.mobile ? '#ef4444' : mobileFocused ? colors.brand : colors.border,
              }]}>
                <Icon name="phone-outline" size={20} color={mobileFocused ? colors.brand : colors.subText} style={styles.inputIcon} />
                <Text style={[styles.dialCode, { color: colors.subText }]}>+91</Text>
                <View style={[styles.dividerV, { backgroundColor: colors.border }]} />
                <TextInput
                  ref={mobileRef}
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter mobile number"
                  placeholderTextColor={colors.placeholder}
                  value={mobile}
                  editable={!isRegisterMode}
                  onChangeText={t => { setMobile(t.replace(/\D/g, '').slice(0, 10)); setErrors(e => ({ ...e, mobile: undefined })); }}
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType={isRegisterMode ? 'done' : isStaffMode ? 'next' : 'done'}
                  onSubmitEditing={isRegisterMode ? undefined : isStaffMode ? () => passwordRef.current?.focus() : handleSendOTP}
                  onFocus={() => setMobileFocused(true)}
                  onBlur={() => setMobileFocused(false)}
                />
              </View>
              {!!errors.mobile && (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle-outline" size={13} color="#ef4444" />
                  <Text style={styles.errorText}>{errors.mobile}</Text>
                </View>
              )}
              {isRegisterMode && (
                <TouchableOpacity onPress={exitRegisterMode} style={{ marginTop: 6, marginLeft: 2 }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={[styles.staffToggleText, { color: colors.brand, fontSize: 12 }]}>Change number</Text>
                </TouchableOpacity>
              )}

              {/* Registration fields — Name + Email only, everything else
                  (Party Type, Sales Channel, Ledger) is set automatically. */}
              {isRegisterMode && (
                <Animated.View entering={FadeInDown.duration(350)}>
                  <Text style={[styles.label, { color: colors.subText, marginTop: 14 }]}>Full Name</Text>
                  <View style={[styles.inputRow, {
                    backgroundColor: colors.raisedSurface,
                    borderColor: errors.name ? '#ef4444' : nameFocused ? colors.brand : colors.border,
                  }]}>
                    <Icon name="account-outline" size={20} color={nameFocused ? colors.brand : colors.subText} style={styles.inputIcon} />
                    <TextInput
                      ref={nameRef}
                      style={[styles.input, { color: colors.text }]}
                      placeholder="Your full name"
                      placeholderTextColor={colors.placeholder}
                      value={name}
                      onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: undefined })); }}
                      returnKeyType="next"
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                    />
                  </View>
                  {!!errors.name && (
                    <View style={styles.errorRow}>
                      <Icon name="alert-circle-outline" size={13} color="#ef4444" />
                      <Text style={styles.errorText}>{errors.name}</Text>
                    </View>
                  )}

                  <Text style={[styles.label, { color: colors.subText, marginTop: 14 }]}>Email (optional)</Text>
                  <View style={[styles.inputRow, {
                    backgroundColor: colors.raisedSurface,
                    borderColor: emailFocused ? colors.brand : colors.border,
                  }]}>
                    <Icon name="email-outline" size={20} color={emailFocused ? colors.brand : colors.subText} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      placeholder="you@example.com"
                      placeholderTextColor={colors.placeholder}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={handleRegister}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                    />
                  </View>
                </Animated.View>
              )}

              {/* Staff password section */}
              {!isRegisterMode && isStaffMode && (
                <Animated.View entering={FadeInDown.duration(350)}>
                  <Text style={[styles.label, { color: colors.subText, marginTop: 14 }]}>Password</Text>
                  <View style={[styles.inputRow, {
                    backgroundColor: colors.raisedSurface,
                    borderColor: errors.password ? '#ef4444' : passwordFocused ? colors.brand : colors.border,
                  }]}>
                    <Icon name="lock-outline" size={20} color={passwordFocused ? colors.brand : colors.subText} style={styles.inputIcon} />
                    <TextInput
                      ref={passwordRef}
                      style={[styles.input, { color: colors.text }]}
                      placeholder="Enter password"
                      placeholderTextColor={colors.placeholder}
                      value={password}
                      onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: undefined })); }}
                      secureTextEntry={!showPass}
                      returnKeyType="done"
                      onSubmitEditing={handleStaffLogin}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                    />
                    <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.subText} />
                    </TouchableOpacity>
                  </View>
                  {!!errors.password && (
                    <View style={styles.errorRow}>
                      <Icon name="alert-circle-outline" size={13} color="#ef4444" />
                      <Text style={styles.errorText}>{errors.password}</Text>
                    </View>
                  )}
                </Animated.View>
              )}

              {/* Primary action button */}
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 20 }]}
                onPress={isRegisterMode ? handleRegister : isStaffMode ? handleStaffLogin : handleSendOTP}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[colors.brandLight, colors.brandDark]}
                  style={styles.btnGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.btnText}>
                    {isRegisterMode ? 'Create Account & Send OTP' : isStaffMode ? 'Sign In' : 'Send OTP'}
                  </Text>
                  <Icon
                    name={isRegisterMode ? 'account-plus-outline' : isStaffMode ? 'login' : 'message-badge-outline'}
                    size={18}
                    color={COLORS.light.onBrand}
                    style={{ marginLeft: 8 }}
                  />
                </LinearGradient>
              </TouchableOpacity>

              {/* Staff mode toggle */}
              {!isRegisterMode && (
                <TouchableOpacity style={styles.staffToggle} onPress={toggleStaffMode} activeOpacity={0.7}>
                  {isStaffMode
                    ? <Animated.View entering={FadeInRight.duration(300)} style={styles.staffToggleInner}>
                      <Icon name="arrow-left" size={16} color={colors.brand} />
                      <Text style={[styles.staffToggleText, { color: colors.brand }]}>  Back to OTP login</Text>
                    </Animated.View>
                    : <Animated.View entering={FadeInRight.duration(300)} style={styles.staffToggleInner}>
                      <Icon name="account-tie-outline" size={18} color={colors.brand} />
                      <Text style={[styles.staffToggleText, { color: colors.brand }]}>  Login as Staff</Text>
                      <Icon name="chevron-right" size={16} color={colors.brand} />
                    </Animated.View>
                  }
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Terms */}
            <Animated.View entering={FadeInDown.duration(600).delay(500)} style={styles.terms}>
              <Text style={[styles.termsText, { color: colors.subText }]}>
                {STRINGS.common.byContinuing}
                <Text style={[styles.termsLink, { color: colors.brand }]} onPress={() => navigation.navigate('TermsCondition')}>
                  {STRINGS.common.termsCondition}
                </Text>
                {STRINGS.common.and}
                <Text style={[styles.termsLink, { color: colors.brand }]} onPress={() => navigation.navigate('PrivacyPolicy')}>
                  {STRINGS.common.privacyPolicy}
                </Text>
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
  scroll: { paddingHorizontal: 22, paddingBottom: 40, flexGrow: 1 },
  glow: { position: 'absolute', width: '120%', height: 190, opacity: 1 },
  glowOne: { backgroundColor: COLORS.light.brandSoft, top: -72, right: -34, borderBottomLeftRadius: 120, transform: [{ rotate: '-7deg' }] },
  glowTwo: { backgroundColor: COLORS.light.warmSoft, bottom: 86, left: -48, height: 150, borderTopRightRadius: 110, transform: [{ rotate: '-8deg' }] },

  hero: { paddingTop: 56, paddingBottom: 22, alignItems: 'flex-start' },
  iconBadge: {
    width: 74, height: 74, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, marginBottom: 20,
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 6,
  },
  eyebrow: { fontSize: 12, fontFamily: FONTS.bold, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 32, fontFamily: FONTS.bold, marginTop: 6, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: FONTS.regular, lineHeight: 21 },

  card: {
    borderWidth: 1, borderRadius: 28, padding: 20,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6,
  },
  label: { fontSize: 13, fontFamily: FONTS.semiBold, marginBottom: 8, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 8 },
  dialCode: { fontSize: 15, fontFamily: FONTS.semiBold, marginRight: 4 },
  dividerV: { width: 1, height: 22, marginHorizontal: 8 },
  input: { flex: 1, fontSize: 16, fontFamily: FONTS.medium },
  eyeBtn: { padding: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, marginLeft: 2 },
  errorText: { fontSize: 12, fontFamily: FONTS.medium, color: '#ef4444', marginLeft: 4 },

  primaryBtn: { borderRadius: 16, overflow: 'hidden' },
  btnGrad: { height: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  btnText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.light.onBrand },

  staffToggle: { alignSelf: 'center', marginTop: 18, paddingVertical: 8, paddingHorizontal: 4 },
  staffToggleInner: { flexDirection: 'row', alignItems: 'center' },
  staffToggleText: { fontSize: 14, fontFamily: FONTS.semiBold },

  terms: { marginTop: 20, paddingHorizontal: 6 },
  termsText: { fontSize: 12, fontFamily: FONTS.regular, textAlign: 'center', lineHeight: 18 },
  termsLink: { fontFamily: FONTS.bold },
});
