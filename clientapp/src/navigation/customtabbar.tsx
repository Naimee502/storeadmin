import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../config';

export const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const { colors } = useTheme();

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.cardGlass,
        borderColor:     colors.border,
        shadowColor:     COLORS.light.shadow,
      },
    ]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const label =
          typeof options.tabBarLabel === 'string' ? options.tabBarLabel :
          typeof options.title       === 'string' ? options.title :
          route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabItem}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            {/* Active pill background */}
            <View style={[
              styles.pillWrap,
              isFocused && { backgroundColor: colors.brandSoft },
            ]}>
              {/* Indicator dot above icon */}
              {isFocused && (
                <View style={[styles.indicator, { backgroundColor: colors.brand }]} />
              )}

              {/* Icon */}
              {options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? colors.brand : colors.subText,
                size: 22,
              })}

              {/* Label */}
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: isFocused ? colors.brand : colors.subText },
                  isFocused && styles.labelActive,
                ]}
              >
                {label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: Platform.OS === 'ios' ? 24 : 14,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 6,
    elevation: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  pillWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    minWidth: 52,
    gap: 2,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 3,
    borderRadius: 2,
  },
  label:       { fontSize: 10, fontFamily: FONTS.semiBold, marginTop: 1 },
  labelActive: { fontFamily: FONTS.bold },
});
