import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getScreenComponent, useTheme } from '../config';
import { CustomDrawerContent } from '.';
import { CustomTabBar } from './customtabbar';

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
        }}
        {...(resolvedType === 'drawer' ? { drawerContent: (props) => <CustomDrawerContent {...props} /> } : {})}
        {...(resolvedType === 'tabs'   ? { tabBar: (props) => <CustomTabBar {...props} /> } : {})}
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
            // `color` is whatever the bar rendering this icon decided on —
            // CustomTabBar passes tabBarActive/tabBarInactive, which a business
            // code can override (e.g. "#ADM0001" paints the bar black, so its
            // icons must be white rather than the black `brand`). Falling back
            // to brand/subText keeps any caller that passes no colour unchanged.
            const renderIcon = ({ focused, size, color }: any) => (
              <Icon
                name={focused ? route.icon.focused : route.icon.unfocused}
                size={focused ? size + 2 : size}
                color={color ?? (focused ? colors.brand : colors.subText)}
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
