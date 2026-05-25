import React from 'react';
import { View, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { COLORS, useTheme } from '../config';

type AppLoaderProps = {
  visible: boolean;
};

export const AppLoader: React.FC<AppLoaderProps> = ({ visible }) => {
  const { colors, isDark } = useTheme();
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
    >
      <View style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContainer: {
    backgroundColor: COLORS.light.white,
    padding: 25,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
