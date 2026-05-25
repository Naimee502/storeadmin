import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Animated, Easing, DimensionValue } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
};

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = new Animated.Value(0);
  const [layoutWidth, setLayoutWidth] = React.useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-layoutWidth || -300, layoutWidth || 300],
  });

  return (
    <View
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      style={[
        styles.skeleton,
        {
          width: width as DimensionValue,
          height: height as DimensionValue,
          borderRadius,
        },
        style,
      ]}
    >
      {layoutWidth > 0 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.5)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
    overflow: 'hidden',
  },
});

export default Skeleton;
