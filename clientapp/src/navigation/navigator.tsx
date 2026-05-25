import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FONTS, getScreenComponent, useTheme } from '../config';
import { CustomDrawerContent } from '.';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

export const createNavigator = (config: any) => {
  const {
    type,
    screens,
    headerComponent: Header,
    showDrawer = true,      // flag: set false to skip the drawer (falls back to stack)
    showBottomTabs = true,  // flag: set false to skip bottom tabs (falls back to stack)
  } = config;

  // Resolve effective navigator type based on feature flags
  const resolvedType: string =
    type === 'drawer' && !showDrawer ? 'stack' :
    type === 'tabs'   && !showBottomTabs ? 'stack' :
    type;

  const Navigator = resolvedType === 'tabs' ? Tabs : resolvedType === 'drawer' ? Drawer : Stack;

  const NavigatorComponent = () => {
    const { colors } = useTheme();

    return (
      <Navigator.Navigator
        screenOptions={{
          headerTintColor: colors.brand,
          headerStyle: { backgroundColor: colors.cardGlass },
          headerTitleStyle: { color: colors.text },
          drawerActiveTintColor: colors.brand,
          drawerInactiveTintColor: colors.subText,
          drawerStyle: { backgroundColor: colors.background },
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.subText,
          tabBarLabelStyle: {
            fontSize: 11,
            fontFamily: FONTS.semiBold,
            marginTop: 2,
          },
          tabBarItemStyle: {
            borderRadius: 18,
            marginVertical: 6,
          },
          tabBarStyle: {
            position: 'absolute',
            left: 18,
            right: 18,
            bottom: 14,
            height: 66,
            paddingTop: 6,
            paddingBottom: 8,
            paddingHorizontal: 8,
            borderRadius: 24,
            backgroundColor: colors.cardGlass,
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: colors.border,
            elevation: 12,
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
          },
        }}
        {...(resolvedType === 'drawer' ? { drawerContent: (props) => <CustomDrawerContent {...props} /> } : {})}
      >

        {screens.map((route: any) => {
          let Component: any;

          if (route.subNavigator) {
            // Cascade flags down to sub-navigators unless explicitly overridden
            Component = createNavigator({
              ...route.subNavigator,
              showDrawer: route.subNavigator.showDrawer ?? showDrawer,
              showBottomTabs: route.subNavigator.showBottomTabs ?? showBottomTabs,
            });
          } else {
            Component = getScreenComponent(route.name);
          }

          if (!Component) {
            console.warn('Screen not found:', route.name);
            return null;
          }

          const screenOptions: any = { ...route.options };

          if (route.label) {
            if (resolvedType === 'drawer') screenOptions.drawerLabel = route.label;
            if (resolvedType === 'tabs') screenOptions.tabBarLabel = route.label;
          }

          if (route.icon) {
            const renderIcon = ({ focused, size }: any) => (
              <Icon
                name={focused ? route.icon.focused : route.icon.unfocused}
                size={focused ? size + 2 : size}
                color={focused ? colors.brand : colors.subText}
              />
            );

            if (resolvedType === 'tabs') screenOptions.tabBarIcon = renderIcon;
            if (resolvedType === 'drawer') screenOptions.drawerIcon = renderIcon;
          }

          if (Header && route.options?.headerShown !== false) {
            screenOptions.header = (props: any) => (
              <Header
                {...props}
                label={route.label || route.options?.title || route.name}
                showMenuIcon={resolvedType === 'drawer'}
                {...config.headerProps}
              />
            );
          }

          return (
            <Navigator.Screen
              key={route.name}
              name={route.name}
              component={Component}
              options={screenOptions}
            />
          );
        })}

      </Navigator.Navigator>
    );
  };

  return NavigatorComponent;
};
