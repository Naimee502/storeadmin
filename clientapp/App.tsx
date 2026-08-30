import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ApolloProvider } from '@apollo/client/react';
import { navigationRef, FirebaseManager, UIProvider, useInAppUpdate } from './src/utils';
import { createNavigator } from './src/navigation/navigator';
import { getScreenComponent, NavConfig } from './src/config';
import { ToastProvider } from 'react-native-toast-notifications';
import { AuthProvider, useAuth } from './src/navigation';
import { Provider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './src/store/store';
import { apolloClient, setTokenGetter } from './src/apollo/client';
import AdminSetup from './src/screens/public/adminsetup';
import { useBrandingSync } from './src/apollo/hooks/adminsettings';
import FieldServices from './src/hooks/fieldservices';
import useScreenGuard from './src/hooks/usescreenguard';
import type { RootState } from './src/store/rootreducer';

const RootStack      = createNativeStackNavigator();
const ProtectedStack = createNativeStackNavigator();

// Public stack
const PublicStack = createNavigator(NavConfig.public);

// Role-specific navigators (all created from NavConfig, consistent with existing pattern)
const PartyNav      = createNavigator(NavConfig.party);
const SalesmanNav   = createNavigator(NavConfig.salesman);
const DeliveryNav   = createNavigator(NavConfig.deliveryboy);
const StaffNav      = createNavigator(NavConfig.staff);

/**
 * Protected — shown when isAuthenticated.
 * Renders the correct role navigator based on user.role from Redux.
 */
function ProtectedNavigator() {
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <>
    <FieldServices />
    <ProtectedStack.Navigator screenOptions={{ headerShown: false }}>
      {user?.role === 'party' && (
        <ProtectedStack.Screen name="PartyApp" component={PartyNav} />
      )}
      {user?.role === 'salesman' && (
        <ProtectedStack.Screen name="SalesmanApp" component={SalesmanNav} />
      )}
      {user?.role === 'deliveryboy' && (
        <ProtectedStack.Screen name="DeliveryApp" component={DeliveryNav} />
      )}
      {user?.role === 'staff' && (
        <ProtectedStack.Screen name="StaffApp" component={StaffNav} />
      )}
      {/* Fallback — should not normally reach here */}
      {!user?.role && (
        <ProtectedStack.Screen name="Public" component={PublicStack} />
      )}
    </ProtectedStack.Navigator>
    </>
  );
}

function RootNavigator() {
  // Applies Business Settings -> Screen Capture Protection -> "Mobile app".
  // Lives here rather than in App() because it needs Apollo + Redux, and App()
  // renders ABOVE both providers. Highest point that covers every screen and
  // native modal in one place.
  useScreenGuard();
  // Picks up a logo or theme colour the admin changed in the web panel after
  // this device was activated. Same reason useScreenGuard lives here: highest
  // point that has Apollo + Redux and covers every screen.
  useBrandingSync();
  const { isAuthenticated, isSplashDone, isIntroDone, isActivated, isLoading } = useAuth();
  const token = useSelector((state: RootState) => state.auth.token);

  React.useEffect(() => {
    setTokenGetter(() => token);
  }, [token]);

  if (isLoading) return null;

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {/* Activation comes before the introduction on purpose. Until a business
          code is entered the app has no idea whose app it is, so the intro used
          to run in the default green and then the whole app changed colour once
          the code was typed — which read as a glitch rather than as branding.
          Activating first means every screen after the splash is already the
          business's own colours and name. */}
      {!isSplashDone ? (
        <RootStack.Screen name="Splash" component={getScreenComponent('Splash')!} />
      ) : !isActivated ? (
        <RootStack.Screen name="AdminSetup" component={AdminSetup} />
      ) : !isIntroDone ? (
        <RootStack.Screen name="Introduction" component={getScreenComponent('Introduction')!} />
      ) : isAuthenticated ? (
        <RootStack.Screen name="Protected" component={ProtectedNavigator} />
      ) : (
        <RootStack.Screen name="Public" component={PublicStack} />
      )}

      {NavConfig.shared.map((route: any) => {
        const Component = getScreenComponent(route.name);
        if (!Component) return null;
        return (
          <RootStack.Screen
            key={route.name}
            name={route.name}
            component={Component}
            options={{ presentation: 'modal', ...route.options }}
          />
        );
      })}
    </RootStack.Navigator>
  );
}

export default function App() {
  useInAppUpdate();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  React.useEffect(() => {
    FirebaseManager.register();
  }, []);

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: isDark ? '#000000' : '#FFFFFF',
      card:       isDark ? '#000000' : '#FFFFFF',
      text:       isDark ? '#FFFFFF' : '#000000',
      border:     isDark ? '#2A2A2A' : '#EAEAEA',
      primary:    isDark ? '#FFFFFF' : '#000000',
    },
  };

  return (
    <ApolloProvider client={apolloClient}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SafeAreaProvider>
            <ToastProvider>
              <AuthProvider>
                <UIProvider>
                  <NavigationContainer ref={navigationRef} theme={navigationTheme}>
                    <StatusBar
                      barStyle={isDark ? 'light-content' : 'dark-content'}
                      backgroundColor="transparent"
                      translucent
                    />
                    <RootNavigator />
                  </NavigationContainer>
                </UIProvider>
              </AuthProvider>
            </ToastProvider>
          </SafeAreaProvider>
        </PersistGate>
      </Provider>
    </ApolloProvider>
  );
}
