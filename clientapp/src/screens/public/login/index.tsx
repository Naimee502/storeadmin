import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppTextInput, AppButton } from '../../../components';
import { COLORS, IMAGES, STRINGS, FONTS, useTheme } from '../../../config';
import { useAuth } from '../../../navigation';
import { useUI } from '../../../utils';

export default function Login({ navigation }: any) {
  const { signIn } = useAuth();
  const { showLoader, showToast } = useUI();
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<any>({});

  const sText = STRINGS.login;

  const validate = () => {
    let valid = true;
    let newErrors: any = {};

    if (!name.trim()) {
      newErrors.name = 'User name is required';
      valid = false;
    }
    if (!password.trim()) {
      newErrors.password = 'Password is required';
      valid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  const handleLogin = async () => {
    if (validate()) {
      showLoader(true);
      try {
        await new Promise((resolve: any) => setTimeout(resolve, 1500));
        await signIn();
        showToast('Successfully signed in!', 'success');
      } catch (error) {
        showToast('Invalid credentials. Please try again.', 'danger');
      } finally {
        showLoader(false);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          <Animated.View entering={FadeInUp.duration(800).delay(120)} style={styles.hero}>
            <View style={[styles.logoShell, { backgroundColor: colors.raisedSurface }]}>
              <FastImage source={IMAGES.logo} style={styles.logo} tintColor={isDark ? colors.onBrand : undefined} resizeMode={FastImage.resizeMode.contain} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.eyebrow, { color: colors.brand }]}>Fresh market access</Text>
              <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
              <Text style={[styles.subtitle, { color: colors.subText }]}>Sign in to continue your grocery run, track orders, and reorder your weekly favorites.</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(800).delay(260)} style={[styles.formCard, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <AppTextInput
              label={sText.nameLabel}
              leftIcon="account-outline"
              placeholder={sText.namePlaceholder}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              error={errors.name}
            />
            <AppTextInput
              label={sText.passwordLabel}
              leftIcon="lock-outline"
              placeholder={sText.passwordPlaceholder}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              secureTextEntry
              showEyeIcon
              error={errors.password}
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={[styles.forgotPasswordText, { color: colors.brand }]}>{sText.forgotPassword}</Text>
            </TouchableOpacity>

            <AppButton
              title={sText.signInButton}
              onPress={handleLogin}
              style={[styles.signInButton, { backgroundColor: colors.brand }]}
              textStyle={styles.primaryButtonText}
            />

            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.subText }]}>or</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>

            <TouchableOpacity style={[styles.googleButton, { borderColor: colors.border, backgroundColor: colors.raisedSurface }]}>
              <Icon name="google" size={20} color={colors.google} style={styles.googleIcon} />
              <Text style={[styles.googleButtonText, { color: colors.text }]}>{sText.googleLogin}</Text>
            </TouchableOpacity>

            <View style={styles.termsContainer}>
              <Text style={[styles.termsText, { color: colors.subText }]}>
                {STRINGS.common.byContinuing}
                <Text style={[styles.termsLink, { color: colors.brand }]} onPress={() => navigation.navigate('TermsCondition')}>{` ${STRINGS.common.termsCondition}`}</Text>
                {` ${STRINGS.common.and} `}
                <Text style={[styles.termsLink, { color: colors.brand }]} onPress={() => navigation.navigate('PrivacyPolicy')}>
                  {STRINGS.common.privacyPolicy}
                </Text>
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(800).delay(800)} style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.subText }]}>{sText.noAccount}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={[styles.signUpLinkText, { color: colors.brand }]}>{sText.signUp}</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 40,
    flexGrow: 1,
  },
  glow: {
    position: 'absolute',
    width: '120%',
    height: 190,
    opacity: 1,
  },
  glowOne: {
    backgroundColor: COLORS.light.brandSoft,
    top: -72,
    right: -34,
    borderBottomLeftRadius: 120,
    transform: [{ rotate: '-7deg' }],
  },
  glowTwo: {
    backgroundColor: COLORS.light.warmSoft,
    bottom: 86,
    left: -48,
    height: 150,
    borderTopRightRadius: 110,
    transform: [{ rotate: '-8deg' }],
  },
  hero: {
    paddingTop: 58,
    paddingBottom: 26,
  },
  logoShell: {
    width: 78,
    height: 78,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.light.brand,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  logo: {
    width: 58,
    height: 58,
  },
  heroCopy: {
    marginTop: 26,
  },
  eyebrow: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    fontFamily: FONTS.bold,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    lineHeight: 22,
    marginTop: 10,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -5,
    marginBottom: 25,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  signInButton: {
    marginTop: 10,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: COLORS.light.onBrand,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  divider: { flex: 1, height: 1 },
  dividerText: { paddingHorizontal: 12, fontFamily: FONTS.medium, fontSize: 12 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
  },
  googleIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: FONTS.medium,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    paddingTop: 20,
  },
  footerText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  signUpLinkText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginLeft: 5,
  },
  termsContainer: {
    marginTop: 15,
    paddingHorizontal: 20,
  },
  termsText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    fontFamily: FONTS.bold,
  },
});
