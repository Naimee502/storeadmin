import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { usePowerState } from 'react-native-device-info';
import { FONTS } from '../config';

/**
 * Small battery ring for field staff (salesman / delivery boy), like Zoho
 * FSM shows on the profile card. Green above 50 %, amber 20–50 %, red below,
 * with a bolt while charging.
 */
export const BatteryBadge = () => {
  const power = usePowerState();
  const level = power?.batteryLevel;
  if (level == null || level < 0) return null;

  const pct = Math.round(level * 100);
  const charging = power?.batteryState === 'charging' || power?.batteryState === 'full';
  const color = pct > 50 ? '#16a34a' : pct >= 20 ? '#f59e0b' : '#ef4444';

  return (
    <View style={[styles.ring, { borderColor: color }]} accessibilityLabel={`Battery ${pct} percent`}>
      {charging && <Icon name="lightning-bolt" size={10} color={color} style={styles.bolt} />}
      <Text style={[styles.pct, { color }]}>{pct}%</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    alignSelf: 'center',
    backgroundColor: '#ffffffcc',
  },
  pct: { fontSize: 11, fontFamily: FONTS.bold },
  bolt: { position: 'absolute', top: 2 },
});
