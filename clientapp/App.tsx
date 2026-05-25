import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigationRef, FirebaseManager, UIProvider, useInAppUpdate } from './src/utils';
import { createNavigator } from './src/navigation/navigator';
import { BackHeader } from './src/components';
import { getScreenComponent, NavConfig } from './src/config';
import { ToastProvider } from 'react-native-toast-notifications';
import { AuthProvider, useAuth } from './src/navigation';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './src/store/store';

const RootStack = createNativeStackNavigator();

const PublicStack = createNavigator(NavConfig.public);

const ProtectedStack = createNavigator({
  ...NavConfig.protected,
  headerComponent: BackHeader,
  headerProps: { onBackPress: undefined },
});

function RootNavigator() {
  const { isAuthenticated, isSplashDone, isIntroDone, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>

      {!isSplashDone ? (
        <RootStack.Screen name="Splash" component={getScreenComponent('Splash')!} />
      ) : !isIntroDone ? (
        <RootStack.Screen name="Introduction" component={getScreenComponent('Introduction')!} />
      ) : isAuthenticated ? (
        <RootStack.Screen name="Protected" component={ProtectedStack} />
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
      card: isDark ? '#000000' : '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      border: isDark ? '#2A2A2A' : '#EAEAEA',
      primary: isDark ? '#FFFFFF' : '#000000',
    },
  };

  return (
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
  );
}