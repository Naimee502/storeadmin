import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, StatusBar } from 'react-native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import { WebView } from 'react-native-webview';
import { STRINGS, useTheme } from '../../../config';
import { BackHeader } from '../../../components';
import { GET_ADMIN_SETTINGS } from '../../../apollo/queries/accounts';
import type { RootState } from '../../../store/rootreducer';

export default function TermsCondition() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data: settingsData } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const termsUrl = (settingsData as any)?.getAdminSettings?.termsConditionsUrl || STRINGS.common.termsUrl;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <LinearGradient colors={colors.appGradient} style={StyleSheet.absoluteFill} />

      <BackHeader label="Terms & Conditions" />

      <View style={[styles.webWrap, { backgroundColor: colors.cardGlass }]}>
        <WebView
          source={{ uri: termsUrl }}
          style={styles.webview}
          onLoadEnd={() => setLoading(false)}
        />
        {loading && (
          <View style={[styles.loader, { backgroundColor: colors.cardGlass }]}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webWrap: {
    flex: 1,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 20,
    overflow: 'hidden',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
