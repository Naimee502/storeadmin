import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppButton, AppTextInput } from '../../../components';
import { COLORS, FONTS, useTheme } from '../../../config';
import { useUI } from '../../../utils';

export default function ForgotPassword({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { showToast } = useUI();
  const [email, setEmail] = useState('');

  const handleReset = () => {
    if (!email.trim()) {
      showToast('Please enter your email address', 'danger');
      return;
    }
    showToast('Password reset link sent to your email', 'success');
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeInUp.duration(600).delay(100)}>
            <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.raisedSurface }]} onPress={() => navigation.goBack()}>
              <Icon name="chevron-left" size={30} color={colors.text} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(800).delay(180)} style={styles.hero}>
            <View style={[styles.iconHalo, { backgroundColor: colors.brandOverlay }]}>
              <Icon name="lock-reset" size={44} color={colors.brand} />
            </View>
            <Text style={[styles.eyebrow, { color: colors.brand }]}>Account recovery</Text>
            <Text style={[styles.title, { color: colors.text }]}>Forgot password?</Text>
            <Text style={[styles.subtitle, { color: colors.subText }]}>Enter your registered email and we will send a secure link to reset your password.</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(800).delay(320)} style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <AppTextInput
              label="Email address"
              leftIcon="email-outline"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AppButton title="Send reset link" onPress={handleReset} style={[styles.button, { backgroundColor: colors.brand }]} textStyle={styles.buttonText} />
            <View style={[styles.tip, { backgroundColor: colors.softSurface }]}>
              <Icon name="shield-check-outline" size={18} color={colors.brand} />
              <Text style={[styles.tipText, { color: colors.subText }]}>For your safety, the reset link expires shortly after it is sent.</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(800).delay(500)} style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.subText }]}>Remembered it?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}> Sign in</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 38 },
  glow: { position: 'absolute', width: '120%', height: 190, opacity: 1 },
  glowOne: {
    backgroundColor: COLORS.light.brandSoft,
    top: -72,
    right: -34,
    borderBottomLeftRadius: 120,
    transform: [{ rotate: '-7deg' }],
  },
  glowTwo: {
    backgroundColor: COLORS.light.warmSoft,
    bottom: 110,
    left: -48,
    height: 150,
    borderTopRightRadius: 110,
    transform: [{ rotate: '-8deg' }],
  },
  backButton: { marginTop: 10, width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  hero: { alignItems: 'center', paddingTop: 44, paddingBottom: 26 },
  iconHalo: { width: 96, height: 96, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 22 },
  eyebrow: { fontSize: 12, fontFamily: FONTS.bold, textTransform: 'uppercase' },
  title: { fontSize: 32, fontFamily: FONTS.bold, marginTop: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: FONTS.regular, lineHeight: 22, textAlign: 'center', marginTop: 10, paddingHorizontal: 8 },
  card: { borderWidth: 1, borderRadius: 28, padding: 18, shadowColor: COLORS.light.shadow, shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.1, shadowRadius: 28, elevation: 8 },
  button: { borderRadius: 14, backgroundColor: COLORS.light.brand },
  buttonText: { color: COLORS.light.onBrand },
  tip: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 13, marginTop: 8 },
  tipText: { flex: 1, marginLeft: 10, fontSize: 12, lineHeight: 18, fontFamily: FONTS.medium },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 14, fontFamily: FONTS.medium },
  footerLink: { color: COLORS.light.brand, fontSize: 14, fontFamily: FONTS.bold },
});
