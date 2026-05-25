import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme, NavConfig, IMAGES } from '../config';

export const HEADER_ICONS = {
  menu: 'menu',
  back: 'arrow-left',
  bell: 'bell-outline',
  cart: 'shopping-cart-outline',
  heart: 'heart-outline',
  home: 'home-outline',
} as const;

const LeftSection = ({ type, label, leftIcon, handleLeftPress, onLongPress, colors, showMenuIcon }: any) => {
  const isAppTypeWithoutMenu = type === 'app' && !showMenuIcon;

  return (
    <TouchableOpacity
      style={[styles.leftButton, isAppTypeWithoutMenu && { paddingLeft: 0 }]}
      onPress={handleLeftPress}
      activeOpacity={0.7}
      onLongPress={onLongPress}
      disabled={isAppTypeWithoutMenu}
    >
      {!isAppTypeWithoutMenu && (
        <Icon name={leftIcon} size={24} color={colors.brand} />
      )}
      {isAppTypeWithoutMenu && (
        <Image
          source={IMAGES.logo}
          style={[styles.headerLogo, { borderColor: colors.border }]}
        />
      )}
      {type === 'app' && (
        <Text style={[styles.leftLabel, { color: colors.text }, isAppTypeWithoutMenu && { marginLeft: 10 }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const CenterLabel = ({ type, label, colors }: any) =>
  type === 'back' ? (
    <View style={styles.centerContainer}>
      <Text style={[styles.centerLabel, { color: colors.text }]}>{label}</Text>
    </View>
  ) : null;

const RightSection = ({ rightIcons, colors }: any) => (
  <View style={styles.rightContainer}>
    {rightIcons.map((icon: any) => (
      <TouchableOpacity
        key={icon.id}
        style={[styles.iconButton, icon.style]}
        onPress={icon.onPress}
        onLongPress={icon.onLongPress}
        activeOpacity={icon.activeOpacity ?? 0.7}
        disabled={icon.disabled}
      >
        <Icon
          name={icon.name}
          size={icon.size ?? 26}
          color={icon.color ?? colors.text}
        />
        {icon.badge > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.brand }]}>
            <Text style={[styles.badgeText, { color: colors.onBrand }]}>
              {icon.badge > 99 ? '99+' : icon.badge}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    ))}
  </View>
);

const RightSpacer = ({ type }: any) =>
  type === 'back' ? <View style={styles.spacer} /> : null;

export const DynamicHeader = (props: any) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const {
    type = 'app',
    label = 'Home',
    onPress,
    onLongPress,
    leftIcon = type === 'back' ? HEADER_ICONS.back : HEADER_ICONS.menu,
    rightIcons = [],
    style = {},
    showMenuIcon = true,
  } = props;

  const handleLeftPress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (type === 'back') {
      try {
        navigation?.navigate?.('Home' as never);
      } catch {
        navigation?.goBack?.();
      }
    } else if (type === 'app') {
      const parent: any = navigation?.getParent?.();
      parent?.openDrawer?.();
    }
  };

  const hasDrawer = NavConfig.protected?.showDrawer !== false;
  const shouldShowMenuIcon = showMenuIcon && hasDrawer;

  const containerStyle = [
    styles.container,
    {
      paddingTop: insets.top + 12,
      backgroundColor: colors.cardGlass,
      borderColor: colors.border,
      borderBottomWidth: 1,
    },
    style,
  ];

  return (
    <View style={containerStyle}>
      <LeftSection
        type={type}
        label={label}
        leftIcon={leftIcon}
        handleLeftPress={handleLeftPress}
        onLongPress={onLongPress}
        colors={colors}
        showMenuIcon={shouldShowMenuIcon}
      />
      {type === 'back' ? (
        <>
          <CenterLabel type={type} label={label} colors={colors} />
          <RightSpacer type={type} />
        </>
      ) : (
        rightIcons.length > 0 && <RightSection rightIcons={rightIcons} colors={colors} />
      )}
    </View>
  );
};

export const AppHeader = (props: any) => (
  <DynamicHeader {...props} type="app" />
);

export const BackHeader = (props: any) => (
  <DynamicHeader {...props} type="back" />
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  leftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
  },
  leftLabel: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    marginLeft: 12,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    resizeMode: 'cover',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabel: {
    fontSize: 17,
    fontFamily: FONTS.bold,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconButton: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: FONTS.bold,
  },
  spacer: {
    width: 42,
  },
});
