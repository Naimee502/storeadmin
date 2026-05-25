import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppButton } from '../../../components';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../config';
import { useAuth } from '../../../navigation';
import { useUI } from '../../../utils';

export default function OTPVerification({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const sText = STRINGS.otp;
  const { signIn } = useAuth();
  const { showLoader, showToast } = useUI();
  const [code, setCode] = useState(['', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [timer, setTimer] = useState(30);

  const inputs = useRef<any>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChangeText = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text.slice(-1); // Only take last character
    setCode(newCode);

    if (text && index < 3) {
      inputs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  const handleVerify = async () => {
    const otp = code.join('');
    if (otp.length < 4) {
      showToast(sText.errorEmpty, 'danger');
      return;
    }

    showLoader(true);
    try {
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1500));
      await signIn(); // Automatically completes authentication flow
      showToast(sText.success, 'success');
    } catch {
      showToast(sText.failed, 'danger');
    } finally {
      showLoader(false);
    }
  };

  const handleResend = () => {
    if (timer === 0) {
      setTimer(30);
      setCode(['', '', '', '']);
      inputs.current[0]?.focus();
      setFocusedIndex(0);
      showToast(sText.resent, 'success');
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
        <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.navBar}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.raisedSurface }]} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
            <Icon name="chevron-left" size={30} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.content}>
          <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.brandOverlay }]}>
              <Icon name="shield-check-outline" size={42} color={colors.brand} />
            </View>
            <Text style={styles.eyebrow}>Secure verification</Text>
            <Text style={[styles.title, { color: colors.text }]}>{sText.title}</Text>
            <Text style={[styles.subtitle, { color: colors.subText }]}>
              {sText.subtitle}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(800).delay(400)} style={[styles.otpSection, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <View style={styles.otpContainer}>
              {code.map((digit, index) => (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    {
                      backgroundColor: colors.raisedSurface,
                      borderColor: focusedIndex === index ? colors.brand : colors.border,
                      borderWidth: focusedIndex === index ? 2 : 1,
                    },
                  ]}
                >
                  <TextInput
                    ref={(el) => { inputs.current[index] = el; }}
                    style={[styles.otpInput, { color: colors.text }]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(text) => handleChangeText(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    onFocus={() => setFocusedIndex(index)}
                    selectTextOnFocus
                  />
                </View>
              ))}
            </View>

            <View style={styles.timerContainer}>
              {timer > 0 ? (
                <Text style={[styles.timerText, { color: colors.subText }]}>
                  {sText.timer}<Text style={[styles.boldText, { color: colors.text }]}>{`00:${timer < 10 ? `0${timer}` : timer}`}</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleResend} style={styles.resendButton}>
                  <Icon name="refresh" size={17} color={colors.brand} />
                  <Text style={styles.resendText}>{sText.resend}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(800).delay(600)} style={styles.buttonSection}>
            <AppButton title={sText.verify} onPress={handleVerify} style={styles.verifyButton} textStyle={styles.verifyText} />
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    paddingHorizontal: 20,
    height: 50,
    justifyContent: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  header: {
    alignItems: 'center',
    marginTop: 14,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  eyebrow: {
    color: COLORS.light.brand,
    fontSize: 12,
    fontFamily: FONTS.bold,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },
  otpSection: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 22,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 8,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 18,
  },
  otpBox: {
    width: 52,
    height: 54,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpInput: {
    fontSize: 21,
    fontFamily: FONTS.bold,
    textAlign: 'center',
    width: '100%',
    height: '100%',
    padding: 0,
  },
  timerContainer: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
  },
  boldText: {
    fontFamily: FONTS.bold,
  },
  resendText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.light.brand,
    marginLeft: 6,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonSection: {
    width: '100%',
    marginTop: 'auto',
  },
  verifyButton: {
    backgroundColor: COLORS.light.brand,
    borderRadius: 14,
  },
  verifyText: {
    color: COLORS.light.onBrand,
  },
});
