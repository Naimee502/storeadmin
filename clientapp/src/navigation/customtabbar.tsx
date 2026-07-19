import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Alert,
} from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../config';
import { usePunchGate } from '../apollo/hooks/attendance';

// Tabs reachable WITHOUT punching in: the dashboard (landing tab), the
// attendance tab itself (needed to punch in) and profile (so sign-out is
// never trapped behind the gate). Everything else requires an open punch.
const isGateExempt = (name: string) =>
  /home|dashboard|attendance|profile/i.test(name);

export const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const { colors } = useTheme();
  const { blocked: punchBlocked } = usePunchGate();

  const attendanceRoute = state.routes.find((r) => /attendance/i.test(r.name));

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
          // Punch-in gate: field roles must punch in before working.
          if (punchBlocked && !isGateExempt(route.name)) {
            Alert.alert(
              'Punch in required',
              'Please punch in from the Attendance tab before starting your work.',
              attendanceRoute
                ? [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Go to Attendance', onPress: () => navigation.navigate(attendanceRoute.name) },
                  ]
                : undefined,
            );
            return;
          }
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
