import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FONTS, useTheme } from '../config';

interface Props {
  title: string;
  icon: string;
  subtitle?: string;
}

export function PlaceholderScreen({ title, icon, subtitle }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: colors.brandSoft, borderColor: colors.border }]}>
          <Icon name={icon} size={40} color={colors.brand} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.sub, { color: colors.subText }]}>
          {subtitle ?? 'Under development — coming soon'}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconWrap: {
    width: 90, height: 90, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, marginBottom: 20,
  },
  title: { fontSize: 22, fontFamily: FONTS.bold, textAlign: 'center', marginBottom: 10 },
  sub: { fontSize: 14, fontFamily: FONTS.regular, textAlign: 'center', lineHeight: 22 },
});
