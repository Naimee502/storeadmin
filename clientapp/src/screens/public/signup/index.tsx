import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { AppTextInput, AppButton } from '../../../components';
import { COLORS, STRINGS, FONTS, useTheme } from '../../../config';
import { PermissionHelper } from '../../../utils';

export default function Signup({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const sText = STRINGS.signup;

  const handleSelectImage = () => {
    Alert.alert(
      'Profile Picture',
      'Select an option to upload your profile picture',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const hasPermission = await PermissionHelper.requestPermission('camera');
            if (hasPermission) {
              const result = await launchCamera({ mediaType: 'photo', quality: 0.7 });
              if (result.assets && result.assets[0].uri) {
                setProfileImage(result.assets[0].uri);
              }
            }
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const hasPermission = await PermissionHelper.requestPermission('gallery');
            if (hasPermission) {
              const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.7 });
              if (result.assets && result.assets[0].uri) {
                setProfileImage(result.assets[0].uri);
              }
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleSignUp = () => {
    // Standard mock flow -> Navigate to OTP Verification!
    navigation.navigate('OTPVerification');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowOne, { backgroundColor: colors.brandSoft }]} />
      <View style={[styles.glow, styles.glowTwo]} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInUp.duration(600).delay(100)}>
            <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.raisedSurface }]} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
              <Icon name="chevron-left" size={30} color={colors.text} />
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(800).delay(200)} style={styles.header}>
            <TouchableOpacity
              onPress={handleSelectImage}
              style={[styles.imagePickerContainer, { borderColor: colors.brand, backgroundColor: colors.raisedSurface }]}
            >
              {profileImage ? (
                <FastImage source={{ uri: profileImage }} style={styles.profilePic} />
              ) : (
                <View style={styles.placeholderPic}>
                  <Icon name="camera-plus-outline" size={32} color={colors.brand} />
                </View>
              )}
            </TouchableOpacity>
            <Text style={[styles.eyebrow, { color: colors.brand }]}>Join the fresh list</Text>
            <Text style={[styles.title, { color: colors.text }]}>Create your account</Text>
            <Text style={[styles.subtitle, { color: colors.subText }]}>Set up your profile once and make every checkout faster.</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(800).delay(400)} style={[styles.form, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
            <AppTextInput
              label={sText.name}
              leftIcon="account-outline"
              placeholder={sText.namePlaceholder}
              value={name}
              onChangeText={setName}
            />
            <AppTextInput
              label={sText.email}
              leftIcon="email-outline"
              placeholder={sText.emailPlaceholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AppTextInput
              label={sText.password}
              leftIcon="lock-outline"
              placeholder={sText.passwordPlaceholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              showEyeIcon
            />
            <AppTextInput
              label={sText.confirmPassword}
              leftIcon="shield-lock-outline"
              placeholder={sText.confirmPasswordPlaceholder}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              showEyeIcon
            />

            <AppButton
              title={sText.button}
              onPress={handleSignUp}
              style={[styles.signUpButton, { backgroundColor: colors.brand }]}
              textStyle={styles.primaryButtonText}
            />

            <View style={styles.termsContainer}>
              <Text style={[styles.termsText, { color: colors.subText }]}>
                {STRINGS.common.byContinuing}
                <Text style={[styles.termsLink, { color: colors.brand }]} onPress={() => navigation.navigate('TermsCondition')}>
                  {` ${STRINGS.common.termsCondition}`}
                </Text>
                {` ${STRINGS.common.and} `}
                <Text style={[styles.termsLink, { color: colors.brand }]} onPress={() => navigation.navigate('PrivacyPolicy')}>
                  {STRINGS.common.privacyPolicy}
                </Text>
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(800).delay(600)} style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.subText }]}>{sText.alreadyHaveAccount}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={[styles.signInLinkText, { color: colors.brand }]}>{sText.login}</Text>
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
    top: -72,
    right: -34,
    borderBottomLeftRadius: 120,
    transform: [{ rotate: '-7deg' }],
  },
  glowTwo: {
    backgroundColor: COLORS.light.warmSoft,
    bottom: 100,
    left: -48,
    height: 150,
    borderTopRightRadius: 110,
    transform: [{ rotate: '-8deg' }],
  },
  backButton: {
    marginTop: 10,
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 20,
  },
  imagePickerContainer: {
    width: 108,
    height: 108,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  profilePic: {
    width: '100%',
    height: '100%',
  },
  placeholderPic: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 31,
    fontFamily: FONTS.bold,
    textAlign: 'center',
    marginTop: 7,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 8,
  },
  signUpButton: {
    marginTop: 20,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: COLORS.light.onBrand,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  signInLinkText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    marginLeft: 5,
  },
  termsContainer: {
    marginTop: 25,
    paddingHorizontal: 10,
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
