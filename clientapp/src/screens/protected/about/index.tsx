import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BackHeader } from '../../../components';
import { AboutScreenSkeleton, FONTS, useTheme } from '../../../config';

export default function About({ navigation } : any) {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BackHeader label="About" />
      {isLoading ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <AboutScreenSkeleton />
        </ScrollView>
      ) : (
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>About Screen</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
  },
});
