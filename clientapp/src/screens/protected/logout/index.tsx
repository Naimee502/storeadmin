import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../../navigation';
import { COLORS, FONTS, useTheme } from '../../../config';

type LogoutScreenProps = {
  navigation?: any;
};

export default function Logout({ navigation }: LogoutScreenProps) {
  const { signOut } = useAuth();
  const { colors } = useTheme();
  const handleLogout = () => {
    signOut();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="logout" size={64} color={COLORS.light.error} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Logout</Text>
        <Text style={[styles.message, { color: colors.subText }]}>Are you sure you want to logout?</Text>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: colors.brand }]}
          onPress={() => navigation?.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    fontFamily: FONTS.bold,
  },
  message: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: COLORS.light.error,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
  },
  logoutButtonText: {
    color: COLORS.light.white,
    fontSize: 16,
    fontFamily: FONTS.bold,
    textAlign: 'center',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    width: '100%',
  },
  cancelButtonText: {
    color: COLORS.light.white,
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    textAlign: 'center',
  },
});
