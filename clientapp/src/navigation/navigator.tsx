import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { getScreenComponent, useTheme } from '../config';
import { usePaymentsEnabled, PAYMENT_SCREENS } from '../apollo/hooks/admin';
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
    // Payments module off → the payment tabs and screens are not registered at
    // all, so there is no tab, no drawer entry and no route to land on.
    const paymentsEnabled = usePaymentsEnabled();
    const visibleScreens = useMemo(
      () => (paymentsEnabled ? screens : screens.filter((r: any) => !PAYMENT_SCREENS.has(r.name))),
      [paymentsEnabled],
    );
    // Sub-navigator components built once per screen list. Building them inside
    // the render below gave each render a brand-new component type, so any
    // re-render here (the module query landing, say) would have remounted the
    // whole tree beneath and thrown away its navigation state.
    const subComponents = useMemo(() => {
      const map: Record<string, any> = {};
      screens.forEach((route: any) => {
        if (route.subNavigator) {
          map[route.name] = createNavigator({
            ...route.subNavigator,
            showDrawer: route.subNavigator.showDrawer ?? showDrawer,
            showBottomTabs: route.subNavigator.showBottomTabs ?? showBottomTabs,
          });
        }
      });
      return map;
      // Keyed on the static config, not visibleScreens: hiding a payment route
      // must not rebuild (and so remount) the drawer/tabs beside it.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * freezeOnBlur is the important line here.
     *
     * A party sees a drawer wrapping five tabs wrapping a stack, and every one
     * of those screens stays mounted once visited — which is what makes going
     * back to a tab instant, and also what made the app feel sticky. Each of
     * them holds Apollo watchers and a subscription to the cart, so a single
     * tap on "+" re-rendered Home, Shop, Orders, Payments and Profile, not just
     * the screen in front of the user. Frozen, a blurred screen keeps its state
     * and its scroll position but stops re-rendering until it is looked at
     * again.
     *
     * Memoised because React Navigation recomputes every screen's options when
     * this object's identity changes, and a literal here made that happen on
     * every render of the navigator.
     */
    const screenOptions = useMemo(() => ({
      freezeOnBlur: true,
      headerTintColor: colors.brand,
      headerStyle: { backgroundColor: colors.cardGlass },
      headerTitleStyle: { color: colors.text },
      drawerActiveTintColor: colors.brand,
      drawerInactiveTintColor: colors.subText,
      drawerStyle: { backgroundColor: colors.background },
    }), [colors]);

    return (
      <Navigator.Navigator
        screenOptions={screenOptions}
        {...(resolvedType === 'drawer' ? { drawerContent: (props) => <CustomDrawerContent {...props} /> } : {})}
        {...(resolvedType === 'tabs'   ? { tabBar: (props) => <CustomTabBar {...props} /> } : {})}
      >

        {visibleScreens.map((route: any) => {
          let Component: any;

          if (route.subNavigator) {
            // Cascade flags down to sub-navigators unless explicitly overridden
            Component = subComponents[route.name];
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
