import React, { useState } from 'react';
import { View, StyleSheet, Text, Image } from 'react-native';
import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppModal } from '../components';
import { useAuth } from './authcontext';
import { FONTS, IMAGES, useTheme } from '../config';

export const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const { signOut } = useAuth();
  const { colors } = useTheme();

  const handleLogout = () => {
    setModalVisible(false);
    signOut();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.content}>
        <View style={[styles.header, { backgroundColor: colors.brandSoft }]}>
          <View style={[styles.logoWrap, { backgroundColor: colors.raisedSurface }]}>
            <Image source={IMAGES.logo} style={styles.logo} />
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>Grocery Shop</Text>
          <View style={styles.locationRow}>
            <Icon name="map-marker" color={colors.brand} size={15} />
            <Text style={[styles.userEmail, { color: colors.subText }]}>Delivering to Home</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        
        {/* Render all screens except Logout */}
        {props.state.routes.map((route, index) => {
          if (route.name === 'Logout') return null;
          
          const { drawerLabel, drawerIcon } = props.descriptors[route.key].options;
          const focused = index === props.state.index;

          return (
            <DrawerItem
              key={route.key}
              label={drawerLabel !== undefined ? (drawerLabel as string) : route.name}
              icon={drawerIcon}
              focused={focused}
              activeTintColor={colors.brand}
              inactiveTintColor={colors.subText}
              activeBackgroundColor={colors.brandSoft}
              onPress={() => props.navigation.navigate(route.name)}
              labelStyle={[styles.drawerLabel, focused && { color: colors.brand }]}
              style={styles.drawerItem}
            />
          );
        })}
        
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        
        <DrawerItem
          label="Logout"
          icon={({ size }) => (
            <Icon name="logout" color={colors.error} size={size} />
          )}
          inactiveTintColor={colors.error}
          onPress={() => setModalVisible(true)}
          labelStyle={styles.drawerLabel}
          style={styles.drawerItem}
        />
      </DrawerContentScrollView>

      <AppModal
        visible={modalVisible}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        confirmColor={colors.error}
        iconName="logout-variant"
        onClose={() => setModalVisible(false)}
        onConfirm={handleLogout}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
  },
  header: {
    padding: 18,
    margin: 14,
    borderRadius: 24,
  },
  logoWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  userName: {
    fontSize: 20,
    fontFamily: FONTS.bold,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  userEmail: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    marginVertical: 10,
    marginHorizontal: 15,
  },
  drawerLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  drawerItem: {
    marginHorizontal: 14,
    borderRadius: 16,
    marginVertical: 2,
  },
});
