import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  DimensionValue,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, STRINGS, IMAGES, useTheme } from '../../../config';
import { useAuth } from '../../../navigation';

const { width, height } = Dimensions.get('window');



// 1. Floating Reanimated Animated Icon Component
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
  amplitude = 15,
  opacity = 0.8,
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
          withTiming(-10, { duration: duration }),
          withTiming(10, { duration: duration })
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
          zIndex: 10,
        },
        animatedStyle,
      ]}
    >
      <Icon name={name} size={size} color={color} />
    </Animated.View>
  );
};

// 2. Twinkle Sparkle Component
interface TwinkleStarProps {
  size: number;
  top: DimensionValue;
  left: DimensionValue;
  delay?: number;
  duration?: number;
  color: string;
}

const TwinkleStar: React.FC<TwinkleStarProps> = ({ size, top, left, delay = 0, duration = 2000, color }) => {
  const opacity = useSharedValue(0.1);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: duration / 2 }),
          withTiming(0.1, { duration: duration / 2 })
        ),
        -1,
        true
      )
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.2, { duration: duration / 2 }),
          withTiming(0.4, { duration: duration / 2 })
        ),
        -1,
        true
      )
    );
  }, [delay, duration, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', top, left }, animatedStyle]}>
      <Icon name="star-four-points" size={size} color={color} />
    </Animated.View>
  );
};

// 3. Slide 1 Graphic Component
interface GraphicProps {
  colors: any;
  isDark: boolean;
}

const FreshGroceryGraphic: React.FC<GraphicProps> = ({ colors, isDark }) => {
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2500 }),
        withTiming(8, { duration: 2500 })
      ),
      -1,
      true
    );
  }, [floatY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const iconColor = isDark ? colors.whiteOverlay : colors.brand;
  const starColor = colors.rating;

  return (
    <View style={styles.graphicContainer}>
      <View style={[styles.haloRing, { borderColor: colors.haloBorder }]} />

      <FloatingIcon name="leaf" size={24} color={iconColor} top="12%" left="15%" delay={0} duration={4800} />
      <FloatingIcon name="carrot" size={26} color={iconColor} top="22%" left="78%" delay={1000} duration={5200} />
      <FloatingIcon name="food-apple" size={26} color={iconColor} top="64%" left="12%" delay={500} duration={4500} />
      <FloatingIcon name="fruit-grapes" size={24} color={iconColor} top="60%" left="82%" delay={1500} duration={5000} />
      <FloatingIcon name="sprout" size={22} color={iconColor} top="15%" left="48%" delay={800} duration={4600} />

      <TwinkleStar size={16} top="8%" left="30%" delay={200} duration={2200} color={starColor} />
      <TwinkleStar size={18} top="18%" left="65%" delay={800} duration={2600} color={starColor} />
      <TwinkleStar size={14} top="72%" left="25%" delay={400} duration={1800} color={starColor} />

      <Animated.View style={[styles.imageShadowWrapper, animatedStyle, { shadowColor: colors.text }]}>
        <FastImage
          source={IMAGES.onboardingGrocery}
          style={[styles.illustrationImg, { borderColor: colors.border }]}
          resizeMode={FastImage.resizeMode.cover}
        />
      </Animated.View>
    </View>
  );
};

// 4. Slide 2 Graphic Component
const FastDeliveryGraphic: React.FC<GraphicProps> = ({ colors, isDark }) => {
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2500 }),
        withTiming(8, { duration: 2500 })
      ),
      -1,
      true
    );
  }, [floatY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const iconColor = isDark ? colors.whiteOverlay : colors.brand;
  const starColor = colors.rating;

  return (
    <View style={styles.graphicContainer}>
      <View style={[styles.haloRing, { borderColor: colors.haloBorder }]} />

      <FloatingIcon name="truck-delivery-outline" size={26} color={iconColor} top="14%" left="16%" delay={300} duration={4600} />
      <FloatingIcon name="clock-outline" size={24} color={iconColor} top="20%" left="74%" delay={1200} duration={5000} />
      <FloatingIcon name="package-variant-closed" size={24} color={iconColor} top="66%" left="14%" delay={700} duration={4800} />
      <FloatingIcon name="map-marker-outline" size={26} color={iconColor} top="58%" left="80%" delay={1700} duration={5400} />

      <TwinkleStar size={16} top="10%" left="40%" delay={100} duration={2400} color={starColor} />
      <TwinkleStar size={15} top="72%" left="70%" delay={600} duration={2000} color={starColor} />

      <Animated.View style={[styles.imageShadowWrapper, animatedStyle, { shadowColor: colors.text }]}>
        <FastImage
          source={IMAGES.onboardingFastDelivery}
          style={[styles.illustrationImg, { borderColor: colors.border }]}
          resizeMode={FastImage.resizeMode.cover}
        />
      </Animated.View>
    </View>
  );
};

// 5. Slide 3 Graphic Component
const SecurePaymentsGraphic: React.FC<GraphicProps> = ({ colors, isDark }) => {
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 2500 }),
        withTiming(8, { duration: 2500 })
      ),
      -1,
      true
    );
  }, [floatY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const iconColor = isDark ? colors.whiteOverlay : colors.brand;
  const starColor = colors.rating;

  return (
    <View style={styles.graphicContainer}>
      <View style={[styles.haloRing, { borderColor: colors.haloBorder }]} />

      <FloatingIcon name="credit-card-outline" size={24} color={iconColor} top="12%" left="18%" delay={100} duration={4800} />
      <FloatingIcon name="shield-check-outline" size={26} color={iconColor} top="24%" left="76%" delay={800} duration={4500} />
      <FloatingIcon name="wallet-outline" size={24} color={iconColor} top="64%" left="15%" delay={600} duration={5200} />
      <FloatingIcon name="cash-multiple" size={26} color={iconColor} top="56%" left="82%" delay={1400} duration={4700} />

      <TwinkleStar size={18} top="8%" left="35%" delay={300} duration={2100} color={starColor} />
      <TwinkleStar size={15} top="68%" left="65%" delay={900} duration={2500} color={starColor} />

      <Animated.View style={[styles.imageShadowWrapper, animatedStyle, { shadowColor: colors.text }]}>
        <FastImage
          source={IMAGES.onboardingSecurePay}
          style={[styles.illustrationImg, { borderColor: colors.border }]}
          resizeMode={FastImage.resizeMode.cover}
        />
      </Animated.View>
    </View>
  );
};

// 6. Graphics Selector Component
interface OnboardingGraphicProps {
  index: number;
  colors: any;
  isDark: boolean;
}

const OnboardingGraphic: React.FC<OnboardingGraphicProps> = React.memo(({ index, colors, isDark }) => {
  switch (index) {
    case 0:
      return <FreshGroceryGraphic colors={colors} isDark={isDark} />;
    case 1:
      return <FastDeliveryGraphic colors={colors} isDark={isDark} />;
    case 2:
      return <SecurePaymentsGraphic colors={colors} isDark={isDark} />;
    default:
      return null;
  }
});

// 7. Individual Slide Item
interface SlideItemProps {
  item: any;
  index: number;
  colors: any;
  isDark: boolean;
}

const SlideItem: React.FC<SlideItemProps> = React.memo(({ item, index, colors, isDark }) => {
  return (
    <View style={styles.slide}>
      <Animated.View
        entering={FadeInUp.delay(200).duration(800)}
        style={styles.imageContainer}
      >
        <OnboardingGraphic index={index} colors={colors} isDark={isDark} />
      </Animated.View>
      <Animated.View
        entering={FadeInDown.delay(400).duration(800)}
        style={styles.textContainer}
      >
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.description, { color: colors.subText }]}>{item.description}</Text>
      </Animated.View>
    </View>
  );
});

// 8. Pagination Component
interface PaginationProps {
  currentIndex: number;
  totalSteps: number;
  colors: any;
}

const Pagination: React.FC<PaginationProps> = React.memo(({ currentIndex, totalSteps, colors }) => {
  return (
    <View style={styles.paginationContainer}>
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = currentIndex === index;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              {
                width: isActive ? 24 : 8,
                backgroundColor: isActive ? colors.brand : colors.border,
              },
            ]}
          />
        );
      })}
    </View>
  );
});

// 9. Main Introduction Component
const Introduction = () => {
  const { finishIntro } = useAuth();
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);

  const onboardingSteps = STRINGS.onboarding.steps;

  const handleNext = () => {
    if (currentIndex < onboardingSteps.length - 1) {
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

  const handleSkip = () => {
    finishIntro();
  };

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    return <SlideItem item={item} index={index} colors={colors} isDark={isDark} />;
  }, [colors, isDark]);

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
      />
      <View style={[styles.curveBand, styles.curveBandTop, { backgroundColor: colors.brandSoft }]} />
      <View style={[styles.curveBand, styles.curveBandBottom, { backgroundColor: colors.warmSoft }]} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }} />
          {currentIndex < onboardingSteps.length - 1 && (
            <TouchableOpacity
              onPress={handleSkip}
              activeOpacity={0.7}
              style={[styles.skipButton, { borderColor: colors.border, backgroundColor: colors.raisedSurface }]}
            >
              <Text style={[styles.skipText, { color: colors.subText }]}>{STRINGS.onboarding.skip}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        <FlatList
          ref={flatListRef}
          data={onboardingSteps}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            scrollX.value = e.nativeEvent.contentOffset.x;
          }}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentIndex(index);
          }}
          keyExtractor={(_, index) => index.toString()}
          scrollEventThrottle={16}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Pagination
            currentIndex={currentIndex}
            totalSteps={onboardingSteps.length}
            colors={colors}
          />

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
                {currentIndex === onboardingSteps.length - 1
                  ? STRINGS.onboarding.done
                  : STRINGS.onboarding.next}
              </Text>
            </TouchableOpacity>
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
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: StatusBar.currentHeight,
  },
  curveBand: {
    position: 'absolute',
    width: width * 1.18,
    height: 210,
  },
  curveBandTop: {
    top: -72,
    right: -28,
    borderBottomLeftRadius: 120,
    transform: [{ rotate: '-7deg' }],
  },
  curveBandBottom: {
    bottom: 178,
    left: -44,
    height: 170,
    borderTopRightRadius: 110,
    transform: [{ rotate: '-8deg' }],
  },
  skipButton: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  skipText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  slide: {
    width: width,
    alignItems: 'center',
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  imageContainer: {
    height: height * 0.4,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphicContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  haloRing: {
    position: 'absolute',
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: (width * 0.72) / 2,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  imageShadowWrapper: {
    borderRadius: 34,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
  },
  illustrationImg: {
    width: width * 0.62,
    height: width * 0.62,
    borderRadius: 34,
    borderWidth: 1,
  },
  textContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 34,
  },
  description: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  footer: {
    paddingBottom: 30,
    paddingHorizontal: 25,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 88,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
  },
  nextButton: {
    width: 136,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  nextButtonText: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.light.onBrand,
  },
});

export default Introduction;
