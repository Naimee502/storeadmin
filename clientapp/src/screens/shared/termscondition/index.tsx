import React from 'react';
import { StyleSheet, SafeAreaView, ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { STRINGS, useTheme } from '../../../config';

export default function TermsCondition() {
  const { colors, isDark } = useTheme();
  return (
    <SafeAreaView style={styles.container}>
      <WebView
        source={{ uri: STRINGS.common.termsUrl }}
        style={styles.webview}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={isDark ? colors.primary : colors.primary} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  }
});
