import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { BackHeader } from '../../../components';
import { COLORS, FONTS, useTheme } from '../../../config';

export default function Settings({ navigation } : any) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BackHeader label="Settings" />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        
        <View style={[styles.card, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
          <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <Icon name="bell" size={22} color={colors.brand} />
            <Text style={[styles.settingText, { color: colors.text }]}>Notifications</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <Icon name="lock" size={22} color={colors.brand} />
            <Text style={[styles.settingText, { color: colors.text }]}>Privacy & Security</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <Icon name="palette" size={22} color={colors.brand} />
            <Text style={[styles.settingText, { color: colors.text }]}>Appearance</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <Icon name="information" size={22} color={colors.brand} />
            <Text style={[styles.settingText, { color: colors.text }]}>About</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    fontFamily: FONTS.bold,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingText: {
    marginLeft: 16,
    fontSize: 15,
    fontFamily: FONTS.medium,
  },
});
