import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, Dimensions, StatusBar,
  SafeAreaView, Pressable, DimensionValue,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence,
  withSpring, withDelay, FadeInUp, FadeInDown,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../config';
import { useAuth } from '../../../navigation';

const { height } = Dimensions.get('window');

/* ── Floating background icon ─────────────────────────────────────── */
interface FloatingIconProps {
  name: string; size: number; color: string;
  top: DimensionValue; left: DimensionValue;
  delay?: number; duration?: number; amplitude?: number; opacity?: number;
}
const FloatingIcon: React.FC<FloatingIconProps> = ({
  name, size, color, top, left,
  delay = 0, duration = 5000, amplitude = 20, opacity = 0.1,
}) => {
  const translateY = useSharedValue(0);
  const rotate     = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(delay, withRepeat(withSequence(
      withTiming(-amplitude, { duration: duration / 2 }),
      withTiming(amplitude,  { duration: duration / 2 })),
      -1, true));
    rotate.value = withDelay(delay, withRepeat(withSequence(
      withTiming(-12, { duration }),
      withTiming(12,  { duration })),
      -1, true));
  }, [delay, duration, amplitude, translateY, rotate]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top, left, opacity }, animStyle]}>
      <Icon name={name} size={size} color={color} />
    </Animated.View>
  );
};

/* ── Pulse ring ───────────────────────────────────────────────────── */
const PulseRing: React.FC<{ color: string; delay?: number; duration?: number }> = ({
  color, delay = 0, duration = 3000,
}) => {
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value   = withDelay(delay, withRepeat(withTiming(1.6, { duration }), -1, false));
    opacity.value = withDelay(delay, withRepeat(withSequence(
      withTiming(0.3, { duration: 0 }),
      withTiming(0,   { duration })), -1, false));
  }, [delay, duration, scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.pulseRing, { borderColor: color }, animStyle]} />;
};

/* ── Main screen ──────────────────────────────────────────────────── */
const Splash = () => {
  const { finishSplash } = useAuth();
  const { colors, isDark } = useTheme();
  const sText = STRINGS.splash;

  const badgeScale      = useSharedValue(0);
  const dividerWidth    = useSharedValue(0);
  const buttonScale     = useSharedValue(1);
  const arrowTranslateX = useSharedValue(0);
  const badgeRotate     = useSharedValue(-8);

  useEffect(() => {
    badgeScale.value   = withDelay(100, withSpring(1, { damping: 12, stiffness: 85 }));
    dividerWidth.value = withDelay(700, withTiming(90, { duration: 1000 }));
    arrowTranslateX.value = withRepeat(withSequence(
      withTiming(5, { duration: 600 }), withTiming(0, { duration: 600 })), -1, true);
    badgeRotate.value = withRepeat(withSequence(
      withTiming(-6, { duration: 2000 }), withTiming(6, { duration: 2000 })), -1, true);
  }, [badgeScale, dividerWidth, arrowTranslateX, badgeRotate]);

  const badgeStyle   = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));
  const dividerStyle = useAnimatedStyle(() => ({ width: dividerWidth.value }));
  const buttonStyle  = useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] }));
  const arrowStyle   = useAnimatedStyle(() => ({ transform: [{ translateX: arrowTranslateX.value }] }));
  const trendStyle   = useAnimatedStyle(() => ({ transform: [{ rotate: `${badgeRotate.value}deg` }] }));

  const accent       = colors.brand;
  const particle     = isDark ? colors.whiteOverlay : colors.brand;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={[styles.glow, styles.glowOne, { backgroundColor: colors.brandSoft }]} />
      <View style={[styles.glow, styles.glowTwo]} />

      {/* Floating background business icons */}
      <FloatingIcon name="briefcase-outline"         size={32} color={particle} top="12%" left="10%"  opacity={isDark ? 0.05 : 0.08} delay={0}    duration={5000} />
      <FloatingIcon name="account-group-outline"     size={34} color={particle} top="16%" left="78%"  opacity={isDark ? 0.04 : 0.06} delay={1000} duration={4800} />
      <FloatingIcon name="chart-bar"                 size={36} color={particle} top="38%" left="8%"   opacity={isDark ? 0.05 : 0.08} delay={500}  duration={5500} />
      <FloatingIcon name="invoice-text-outline"      size={34} color={particle} top="42%" left="82%"  opacity={isDark ? 0.04 : 0.06} delay={1500} duration={5200} />
      <FloatingIcon name="currency-inr"              size={32} color={particle} top="68%" left="12%"  opacity={isDark ? 0.04 : 0.06} delay={800}  duration={4600} />
      <FloatingIcon name="map-marker-radius-outline" size={36} color={particle} top="65%" left="80%"  opacity={isDark ? 0.05 : 0.08} delay={2000} duration={6000} />
      <FloatingIcon name="package-variant-closed"    size={32} color={particle} top="25%" left="46%"  opacity={isDark ? 0.05 : 0.08} delay={1200} duration={5000} />
      <FloatingIcon name="handshake-outline"         size={30} color={particle} top="56%" left="24%"  opacity={isDark ? 0.04 : 0.06} delay={300}  duration={5300} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.innerContent}>

          {/* Hero badge */}
          <View style={styles.heroContainer}>
            <PulseRing color={colors.brandSoft} delay={0}    duration={3000} />
            <PulseRing color={colors.brandSoft} delay={1000} duration={3000} />
            <PulseRing color={colors.brandSoft} delay={2000} duration={3000} />

            <Animated.View style={[styles.badgeContainer, badgeStyle, { shadowColor: accent }]}>
              <LinearGradient
                colors={[colors.raisedSurface, colors.brandSoft]}
                style={[styles.badgeGradient, { borderColor: colors.border }]}
              >
                <Icon name="store-outline" size={58} color={accent} />
                <Animated.View style={[styles.trendBadge, trendStyle, { backgroundColor: accent, shadowColor: accent }]}>
                  <Icon name="trending-up" size={22} color={colors.onBrand} />
                </Animated.View>
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Bottom text + button */}
          <View style={styles.contentBottom}>
            <Animated.View entering={FadeInUp.duration(1000).delay(300)} style={styles.textContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                <Text style={{ opacity: 0.7, fontFamily: FONTS.regular }}>{sText.title.split(' ')[0]}</Text>
                {' '}
                <Text style={{ fontFamily: FONTS.bold, color: accent }}>{sText.title.split(' ')[1] || 'Suite'}</Text>
              </Text>

              <View style={styles.dividerContainer}>
                <Animated.View style={[styles.dividerLine, dividerStyle, { backgroundColor: colors.border }]} />
                <View style={[styles.dividerIconContainer, { backgroundColor: colors.background }]}>
                  <Icon name="briefcase-outline" size={14} color={accent} />
                </View>
              </View>

              <Text style={[styles.subtitle, { color: colors.subText }]}>
                {sText.subtitle.toUpperCase()}
              </Text>
              <Text style={[styles.description, { color: colors.subText }]}>
                {sText.description}
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(800).delay(600)} style={styles.buttonContainer}>
              <Pressable
                onPress={finishSplash}
                onPressIn={() => { buttonScale.value = withSpring(0.96, { damping: 8, stiffness: 220 }); }}
                onPressOut={() => { buttonScale.value = withSpring(1,    { damping: 8, stiffness: 220 }); }}
                style={styles.pressable}
              >
                <Animated.View style={[styles.customButton, buttonStyle, { shadowColor: accent, shadowOpacity: isDark ? 0.15 : 0.25 }]}>
                  <LinearGradient
                    colors={[colors.brandLight, colors.brandDark]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  />
                  <Text style={styles.buttonText}>{sText.button}</Text>
                  <Animated.View style={[styles.arrowContainer, arrowStyle]}>
                    <Icon name="arrow-right" size={20} color={accent} />
                  </Animated.View>
                </Animated.View>
              </Pressable>
            </Animated.View>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
};

export default Splash;

const styles = StyleSheet.create({
  container:    { flex: 1 },
  safeArea:     { flex: 1 },
  glow:         { position: 'absolute', width: '120%', height: 210, opacity: 1 },
  glowOne:      { top: -76, right: -34, borderBottomLeftRadius: 120, transform: [{ rotate: '-7deg' }] },
  glowTwo:      { backgroundColor: COLORS.light.warmSoft,  bottom: 110, left: -48, height: 150, borderTopRightRadius: 110, transform: [{ rotate: '-8deg' }] },
  innerContent: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'space-between' },
  heroContainer:{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: height * 0.05 },
  pulseRing:    { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1.5 },
  badgeContainer: { width: 156, height: 156, borderRadius: 42, elevation: 8, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, overflow: 'hidden' },
  badgeGradient:  { flex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderRadius: 42 },
  trendBadge:   { position: 'absolute', top: 30, right: 30, borderRadius: 14, padding: 4, elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  contentBottom:{ width: '100%', alignItems: 'center', marginBottom: height * 0.03 },
  textContainer:{ alignItems: 'center', marginBottom: height * 0.05 },
  title:        { fontSize: 40, textAlign: 'center', fontFamily: FONTS.bold, lineHeight: 46 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 14, height: 20, width: '100%' },
  dividerLine:  { height: 1, position: 'absolute' },
  dividerIconContainer: { paddingHorizontal: 8, zIndex: 2 },
  subtitle:     { fontSize: 14, fontFamily: FONTS.bold, letterSpacing: 4 },
  description:  { fontSize: 15, textAlign: 'center', marginTop: 14, paddingHorizontal: 28, lineHeight: 22, fontFamily: FONTS.regular },
  buttonContainer: { width: '100%', paddingHorizontal: 12 },
  pressable:    { width: '100%', height: 48 },
  customButton: { flex: 1, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', elevation: 4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 16 },
  buttonText:   { fontSize: 15, fontFamily: FONTS.bold, marginRight: 6, color: COLORS.light.onBrand },
  arrowContainer: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 6, backgroundColor: COLORS.light.onBrand },
});
