import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Pressable,
  DimensionValue,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../config';
import { useAuth } from '../../../navigation';

const { width, height } = Dimensions.get('window');

interface FloatingIconProps {
  name: string;
  size: number;
  color: string;
  top: DimensionValue;
  left: DimensionValue;
  delay?: number;
  duration?: number;
  amplitude?: number;
  opacity?: number;
}

const FloatingIcon: React.FC<FloatingIconProps> = ({
  name,
  size,
  color,
  top,
  left,
  delay = 0,
  duration = 5000,
  amplitude = 20,
  opacity = 0.1,
}) => {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-amplitude, { duration: duration / 2 }),
          withTiming(amplitude, { duration: duration / 2 })
        ),
        -1,
        true
      )
    );

    rotate.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-12, { duration: duration }),
          withTiming(12, { duration: duration })
        ),
        -1,
        true
      )
    );
  }, [delay, duration, amplitude, translateY, rotate]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top,
          left,
          opacity,
        },
        animatedStyle,
      ]}
    >
      <Icon name={name} size={size} color={color} />
    </Animated.View>
  );
};

interface PulseRingProps {
  color: string;
  delay?: number;
  duration?: number;
}

const PulseRing: React.FC<PulseRingProps> = ({ color, delay = 0, duration = 3000 }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(withTiming(1.6, { duration }), -1, false)
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 0 }),
          withTiming(0, { duration })
        ),
        -1,
        false
      )
    );
  }, [delay, duration, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          borderColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

const Splash = () => {
  const { finishSplash } = useAuth();
  const { colors, isDark } = useTheme();
  const sText = STRINGS.splash;

  const badgeScale = useSharedValue(0);
  const leafRotate = useSharedValue(-20);
  const dividerWidth = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const arrowTranslateX = useSharedValue(0);

  useEffect(() => {
    badgeScale.value = withDelay(
      100,
      withSpring(1, { damping: 12, stiffness: 85 })
    );

    leafRotate.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 1800 }),
        withTiming(-30, { duration: 1800 })
      ),
      -1,
      true
    );

    dividerWidth.value = withDelay(
      700,
      withTiming(90, { duration: 1000 })
    );

    arrowTranslateX.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 600 }),
        withTiming(0, { duration: 600 })
      ),
      -1,
      true
    );
  }, [badgeScale, leafRotate, dividerWidth, arrowTranslateX]);

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const leafAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${leafRotate.value}deg` }],
  }));

  const dividerAnimatedStyle = useAnimatedStyle(() => ({
    width: dividerWidth.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const arrowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowTranslateX.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 8, stiffness: 220 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 8, stiffness: 220 });
  };

  const accentColor = colors.brand;
  const particleColor = isDark ? colors.whiteOverlay : colors.brand;
  const ringColor = colors.brandSoft;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient
        colors={colors.appGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.glow, styles.glowOne]} />
      <View style={[styles.glow, styles.glowTwo]} />

      <FloatingIcon name="leaf" size={32} color={particleColor} top="12%" left="10%" opacity={isDark ? 0.05 : 0.08} delay={0} duration={5000} />
      <FloatingIcon name="carrot" size={34} color={particleColor} top="16%" left="78%" opacity={isDark ? 0.04 : 0.06} delay={1000} duration={4800} />
      <FloatingIcon name="food-apple" size={36} color={particleColor} top="38%" left="8%" opacity={isDark ? 0.05 : 0.08} delay={500} duration={5500} />
      <FloatingIcon name="fruit-grapes" size={34} color={particleColor} top="42%" left="82%" opacity={isDark ? 0.04 : 0.06} delay={1500} duration={5200} />
      <FloatingIcon name="cheese" size={32} color={particleColor} top="68%" left="12%" opacity={isDark ? 0.04 : 0.06} delay={800} duration={4600} />
      <FloatingIcon name="shopping" size={36} color={particleColor} top="65%" left="80%" opacity={isDark ? 0.05 : 0.08} delay={2000} duration={6000} />
      <FloatingIcon name="sprout" size={32} color={particleColor} top="25%" left="46%" opacity={isDark ? 0.05 : 0.08} delay={1200} duration={5000} />
      <FloatingIcon name="basket-outline" size={30} color={particleColor} top="56%" left="24%" opacity={isDark ? 0.04 : 0.06} delay={300} duration={5300} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.innerContent}>
          <View style={styles.heroContainer}>
            <PulseRing color={ringColor} delay={0} duration={3000} />
            <PulseRing color={ringColor} delay={1000} duration={3000} />
            <PulseRing color={ringColor} delay={2000} duration={3000} />

            <Animated.View style={[styles.badgeContainer, badgeAnimatedStyle, { shadowColor: accentColor }]}>
              <LinearGradient
                colors={[colors.raisedSurface, colors.brandSoft]}
                style={[styles.badgeGradient, { borderColor: colors.border }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Icon
                  name="basket"
                  size={58}
                  color={accentColor}
                  style={styles.basketIcon}
                />
                <Animated.View style={[styles.leafBadge, leafAnimatedStyle, { backgroundColor: accentColor, shadowColor: accentColor }]}>
                  <Icon name="leaf" size={26} color={colors.onBrand} />
                </Animated.View>
              </LinearGradient>
            </Animated.View>
          </View>

          <View style={styles.contentBottom}>
            <Animated.View
              entering={FadeInUp.duration(1000).delay(300)}
              style={styles.textContainer}
            >
              <Text style={[styles.title, { color: colors.text }]}>
                <Text style={{ opacity: 0.7, fontFamily: FONTS.regular }}>{sText.title.split(' ')[0]}</Text>{' '}
                <Text style={{ fontFamily: FONTS.bold, color: accentColor }}>{sText.title.split(' ')[1] || 'Shop'}</Text>
              </Text>

              <View style={styles.dividerContainer}>
                <Animated.View style={[styles.dividerLine, dividerAnimatedStyle, { backgroundColor: colors.border }]} />
                <View style={[styles.dividerIconContainer, { backgroundColor: colors.background }]}>
                  <Icon name="leaf" size={14} color={accentColor} />
                </View>
              </View>

              <Text style={[styles.subtitle, { color: colors.subText }]}>
                {sText.subtitle.toUpperCase()}
              </Text>
              <Text style={[styles.description, { color: colors.subText }]}>
                {sText.description}
              </Text>
            </Animated.View>

            <Animated.View
              entering={FadeInDown.duration(800).delay(600)}
              style={styles.buttonContainer}
            >
              <Pressable
                onPress={finishSplash}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.pressable}
              >
                <Animated.View style={[styles.customButton, buttonAnimatedStyle, { shadowColor: accentColor, shadowOpacity: isDark ? 0.15 : 0.25 }]}>
                  <LinearGradient
                    colors={[colors.brandLight, colors.brandDark]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <Text style={styles.buttonText}>{sText.button}</Text>
                  <Animated.View style={[styles.arrowContainer, arrowAnimatedStyle]}>
                    <Icon name="arrow-right" size={20} color={accentColor} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    width: '120%',
    height: 210,
    opacity: 1,
  },
  glowOne: {
    backgroundColor: COLORS.light.brandSoft,
    top: -76,
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
  innerContent: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: height * 0.05,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
  },
  badgeContainer: {
    width: 156,
    height: 156,
    borderRadius: 42,
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    overflow: 'hidden',
  },
  badgeGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 42,
  },
  basketIcon: {
    marginTop: 4,
  },
  leafBadge: {
    position: 'absolute',
    top: 30,
    right: 30,
    borderRadius: 14,
    padding: 4,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  contentBottom: {
    width: '100%',
    alignItems: 'center',
    marginBottom: height * 0.03,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: height * 0.05,
  },
  title: {
    fontSize: 40,
    textAlign: 'center',
    fontFamily: FONTS.bold,
    lineHeight: 46,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    height: 20,
    width: '100%',
  },
  dividerLine: {
    height: 1,
    position: 'absolute',
  },
  dividerIconContainer: {
    paddingHorizontal: 8,
    zIndex: 2,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    letterSpacing: 4,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 28,
    lineHeight: 22,
    fontFamily: FONTS.regular,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 12,
  },
  pressable: {
    width: '100%',
    height: 48,
  },
  customButton: {
    flex: 1,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
  },
  buttonText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    marginRight: 6,
    color: COLORS.light.onBrand,
  },
  arrowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    backgroundColor: COLORS.light.onBrand,
  },
});

export default Splash;
