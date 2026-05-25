import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  TouchableOpacity, SafeAreaView, StatusBar, DimensionValue,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence, withDelay,
  FadeInUp, FadeInDown,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, STRINGS, useTheme } from '../../../config';
import { useAuth } from '../../../navigation';

const { width, height } = Dimensions.get('window');

/* ── Floating icon ────────────────────────────────────────────────── */
interface FloatingIconProps {
  name: string; size: number; color: string;
  top: DimensionValue; left: DimensionValue;
  delay?: number; duration?: number; amplitude?: number; opacity?: number;
}
const FloatingIcon: React.FC<FloatingIconProps> = ({
  name, size, color, top, left,
  delay = 0, duration = 5000, amplitude = 15, opacity = 0.8,
}) => {
  const translateY = useSharedValue(0);
  const rotate     = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(delay, withRepeat(withSequence(
      withTiming(-amplitude, { duration: duration / 2 }),
      withTiming(amplitude,  { duration: duration / 2 })), -1, true));
    rotate.value = withDelay(delay, withRepeat(withSequence(
      withTiming(-10, { duration }),
      withTiming(10,  { duration })), -1, true));
  }, [delay, duration, amplitude, translateY, rotate]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top, left, opacity, zIndex: 10 }, animStyle]}>
      <Icon name={name} size={size} color={color} />
    </Animated.View>
  );
};

/* ── Twinkle star ─────────────────────────────────────────────────── */
const TwinkleStar: React.FC<{ size: number; top: DimensionValue; left: DimensionValue; delay?: number; duration?: number; color: string }> = ({
  size, top, left, delay = 0, duration = 2000, color,
}) => {
  const opacity = useSharedValue(0.1);
  const scale   = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(withSequence(
      withTiming(0.8, { duration: duration / 2 }),
      withTiming(0.1, { duration: duration / 2 })), -1, true));
    scale.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1.2, { duration: duration / 2 }),
      withTiming(0.4, { duration: duration / 2 })), -1, true));
  }, [delay, duration, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ position: 'absolute', top, left }, animStyle]}>
      <Icon name="star-four-points" size={size} color={color} />
    </Animated.View>
  );
};

/* ── Center icon card (replaces FastImage) ────────────────────────── */
interface CenterCardProps { iconName: string; colors: any; }

const CenterCard: React.FC<CenterCardProps> = ({ iconName, colors }) => {
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(withSequence(
      withTiming(-10, { duration: 2500 }),
      withTiming(10,  { duration: 2500 })), -1, true);
  }, [floatY]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));

  return (
    <Animated.View style={[styles.centerCardWrap, animStyle, { shadowColor: colors.text }]}>
      <LinearGradient
        colors={[colors.raisedSurface, colors.brandSoft]}
        style={[styles.centerCard, { borderColor: colors.border }]}
      >
        <Icon name={iconName} size={88} color={colors.brand} />
      </LinearGradient>
    </Animated.View>
  );
};

/* ── Slide graphics (no local images, pure icon compositions) ─────── */
interface GraphicProps { colors: any; isDark: boolean; }

const PartyManagementGraphic: React.FC<GraphicProps> = ({ colors, isDark }) => {
  const ic = isDark ? colors.whiteOverlay : colors.brand;
  const st = colors.rating;
  return (
    <View style={styles.graphicContainer}>
      <View style={[styles.haloRing, { borderColor: colors.haloBorder }]} />
      <FloatingIcon name="store-outline"         size={26} color={ic} top="12%" left="16%" delay={0}    duration={4800} />
      <FloatingIcon name="handshake-outline"      size={28} color={ic} top="22%" left="74%" delay={1000} duration={5200} />
      <FloatingIcon name="currency-inr"           size={26} color={ic} top="64%" left="14%" delay={500}  duration={4500} />
      <FloatingIcon name="account-plus-outline"   size={24} color={ic} top="58%" left="80%" delay={1500} duration={5000} />
      <FloatingIcon name="tag-outline"            size={22} color={ic} top="15%" left="48%" delay={800}  duration={4600} />
      <TwinkleStar size={16} top="8%"  left="30%" delay={200} duration={2200} color={st} />
      <TwinkleStar size={18} top="18%" left="65%" delay={800} duration={2600} color={st} />
      <TwinkleStar size={14} top="72%" left="25%" delay={400} duration={1800} color={st} />
      <CenterCard iconName="account-group-outline" colors={colors} />
    </View>
  );
};

const SalesOrdersGraphic: React.FC<GraphicProps> = ({ colors, isDark }) => {
  const ic = isDark ? colors.whiteOverlay : colors.brand;
  const st = colors.rating;
  return (
    <View style={styles.graphicContainer}>
      <View style={[styles.haloRing, { borderColor: colors.haloBorder }]} />
      <FloatingIcon name="cart-arrow-up"          size={26} color={ic} top="14%" left="16%" delay={300}  duration={4600} />
      <FloatingIcon name="receipt"                size={24} color={ic} top="20%" left="74%" delay={1200} duration={5000} />
      <FloatingIcon name="trending-up"            size={24} color={ic} top="66%" left="14%" delay={700}  duration={4800} />
      <FloatingIcon name="invoice-text-outline"   size={26} color={ic} top="58%" left="80%" delay={1700} duration={5400} />
      <TwinkleStar size={16} top="10%" left="40%" delay={100} duration={2400} color={st} />
      <TwinkleStar size={15} top="72%" left="70%" delay={600} duration={2000} color={st} />
      <CenterCard iconName="clipboard-list-outline" colors={colors} />
    </View>
  );
};

const StaffRouteGraphic: React.FC<GraphicProps> = ({ colors, isDark }) => {
  const ic = isDark ? colors.whiteOverlay : colors.brand;
  const st = colors.rating;
  return (
    <View style={styles.graphicContainer}>
      <View style={[styles.haloRing, { borderColor: colors.haloBorder }]} />
      <FloatingIcon name="calendar-check-outline" size={24} color={ic} top="12%" left="18%" delay={100}  duration={4800} />
      <FloatingIcon name="clock-check-outline"    size={26} color={ic} top="24%" left="76%" delay={800}  duration={4500} />
      <FloatingIcon name="account-tie-outline"    size={24} color={ic} top="64%" left="15%" delay={600}  duration={5200} />
      <FloatingIcon name="motorbike"              size={26} color={ic} top="56%" left="82%" delay={1400} duration={4700} />
      <TwinkleStar size={18} top="8%"  left="35%" delay={300} duration={2100} color={st} />
      <TwinkleStar size={15} top="68%" left="65%" delay={900} duration={2500} color={st} />
      <CenterCard iconName="map-marker-path" colors={colors} />
    </View>
  );
};

/* ── Graphic selector ─────────────────────────────────────────────── */
const OnboardingGraphic: React.FC<{ index: number; colors: any; isDark: boolean }> = React.memo(({ index, colors, isDark }) => {
  switch (index) {
    case 0: return <PartyManagementGraphic colors={colors} isDark={isDark} />;
    case 1: return <SalesOrdersGraphic     colors={colors} isDark={isDark} />;
    case 2: return <StaffRouteGraphic      colors={colors} isDark={isDark} />;
    default: return null;
  }
});

/* ── Slide item ───────────────────────────────────────────────────── */
const SlideItem: React.FC<{ item: any; index: number; colors: any; isDark: boolean }> = React.memo(({ item, index, colors, isDark }) => (
  <View style={styles.slide}>
    <Animated.View entering={FadeInUp.delay(200).duration(800)} style={styles.imageContainer}>
      <OnboardingGraphic index={index} colors={colors} isDark={isDark} />
    </Animated.View>
    <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.textContainer}>
      <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.description, { color: colors.subText }]}>{item.description}</Text>
    </Animated.View>
  </View>
));

/* ── Pagination ───────────────────────────────────────────────────── */
const Pagination: React.FC<{ currentIndex: number; totalSteps: number; colors: any }> = React.memo(({ currentIndex, totalSteps, colors }) => (
  <View style={styles.paginationContainer}>
    {Array.from({ length: totalSteps }).map((_, i) => (
      <View
        key={i}
        style={[styles.dot, { width: currentIndex === i ? 24 : 8, backgroundColor: currentIndex === i ? colors.brand : colors.border }]}
      />
    ))}
  </View>
));

/* ── Main component ───────────────────────────────────────────────── */
const Introduction = () => {
  const { finishIntro } = useAuth();
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX    = useSharedValue(0);

  const steps = STRINGS.onboarding.steps;

  const handleNext = () => {
    if (currentIndex < steps.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      finishIntro();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
    }
  };

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <SlideItem item={item} index={index} colors={colors} isDark={isDark} />
  ), [colors, isDark]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <View style={[styles.curveBand, styles.curveBandTop,    { backgroundColor: colors.brandSoft }]} />
      <View style={[styles.curveBand, styles.curveBandBottom, { backgroundColor: colors.warmSoft  }]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }} />
          {currentIndex < steps.length - 1 && (
            <TouchableOpacity
              onPress={finishIntro}
              activeOpacity={0.7}
              style={[styles.skipButton, { borderColor: colors.border, backgroundColor: colors.raisedSurface }]}
            >
              <Text style={[styles.skipText, { color: colors.subText }]}>{STRINGS.onboarding.skip}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={steps}
          renderItem={renderItem}
          horizontal pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={e => { scrollX.value = e.nativeEvent.contentOffset.x; }}
          onMomentumScrollEnd={e => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          keyExtractor={(_, i) => i.toString()}
          scrollEventThrottle={16}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Pagination currentIndex={currentIndex} totalSteps={steps.length} colors={colors} />
          <View style={styles.buttonRow}>
            {currentIndex > 0 ? (
              <TouchableOpacity
                onPress={handlePrevious}
                activeOpacity={0.7}
                style={[styles.backButton, { backgroundColor: colors.raisedSurface }]}
              >
                <Text style={[styles.backButtonText, { color: colors.text }]}>{STRINGS.onboarding.previous}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 100 }} />
            )}
            <TouchableOpacity
              onPress={handleNext}
              activeOpacity={0.8}
              style={[styles.nextButton, { backgroundColor: colors.brand, shadowColor: colors.brand }]}
            >
              <Text style={styles.nextButtonText}>
                {currentIndex === steps.length - 1 ? STRINGS.onboarding.done : STRINGS.onboarding.next}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default Introduction;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 60, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginTop: StatusBar.currentHeight,
  },
  curveBand: { position: 'absolute', width: width * 1.18, height: 210 },
  curveBandTop:    { top: -72,   right: -28, borderBottomLeftRadius: 120, transform: [{ rotate: '-7deg' }] },
  curveBandBottom: { bottom: 178, left: -44, height: 170, borderTopRightRadius: 110, transform: [{ rotate: '-8deg' }] },
  skipButton: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  skipText:   { fontSize: 14, fontFamily: FONTS.medium },
  slide:      { width, alignItems: 'center', paddingHorizontal: 30, justifyContent: 'center' },
  imageContainer: { height: height * 0.4, width: '100%', justifyContent: 'center', alignItems: 'center' },
  graphicContainer: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  haloRing: {
    position: 'absolute',
    width: width * 0.72, height: width * 0.72,
    borderRadius: (width * 0.72) / 2,
    borderWidth: 1, borderStyle: 'dashed',
  },
  centerCardWrap: {
    borderRadius: 34,
    shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.14, shadowRadius: 28, elevation: 10,
  },
  centerCard: {
    width: width * 0.52, height: width * 0.52,
    borderRadius: 34, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  textContainer: { marginTop: 20, alignItems: 'center' },
  title:       { fontSize: 28, fontFamily: FONTS.bold, textAlign: 'center', marginBottom: 15, lineHeight: 34 },
  description: { fontSize: 16, fontFamily: FONTS.regular, textAlign: 'center', lineHeight: 24, paddingHorizontal: 10 },
  footer:      { paddingBottom: 30, paddingHorizontal: 25 },
  paginationContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: 30 },
  dot:         { height: 8, borderRadius: 4, marginHorizontal: 4 },
  buttonRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton:  { width: 88, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  backButtonText: { fontSize: 14, fontFamily: FONTS.medium },
  nextButton:  { width: 136, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 14, elevation: 5 },
  nextButtonText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.light.onBrand },
});
