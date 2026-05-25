import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY    = '@is_authenticated';
const SPLASH_KEY  = '@is_splash_done';
const INTRO_KEY   = '@is_intro_done';
const ACTIVATE_KEY = '@is_business_activated';

type AuthContextType = {
  isAuthenticated: boolean;
  isSplashDone: boolean;
  isIntroDone: boolean;
  isActivated: boolean;
  isLoading: boolean;
  signIn: () => void;
  signOut: () => void;
  finishSplash: () => void;
  finishIntro: () => void;
  activateBusiness: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSplashDone,    setIsSplashDone]    = useState(false);
  const [isIntroDone,     setIsIntroDone]     = useState(false);
  const [isActivated,     setIsActivated]     = useState(false);
  const [isLoading,       setIsLoading]       = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [auth, splash, intro, activated] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEY),
          AsyncStorage.getItem(SPLASH_KEY),
          AsyncStorage.getItem(INTRO_KEY),
          AsyncStorage.getItem(ACTIVATE_KEY),
        ]);

        if (auth === 'true') {
          setIsAuthenticated(true);
          setIsSplashDone(true);
          setIsIntroDone(true);
          setIsActivated(true);
        } else {
          if (splash    === 'true') setIsSplashDone(true);
          if (intro     === 'true') setIsIntroDone(true);
          if (activated === 'true') setIsActivated(true);
        }
      } catch (e) {
        console.error('Failed to load auth state', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const signIn = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(AUTH_KEY,     'true'),
        AsyncStorage.setItem(SPLASH_KEY,   'true'),
        AsyncStorage.setItem(INTRO_KEY,    'true'),
        AsyncStorage.setItem(ACTIVATE_KEY, 'true'),
      ]);
      setIsAuthenticated(true);
      setIsSplashDone(true);
      setIsIntroDone(true);
      setIsActivated(true);
    } catch (e) {
      console.error('Failed to save sign-in state', e);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem(AUTH_KEY);
      setIsAuthenticated(false);
    } catch (e) {
      console.error('Failed to remove auth state', e);
    }
  };

  const finishSplash = async () => {
    try {
      await AsyncStorage.setItem(SPLASH_KEY, 'true');
      setIsSplashDone(true);
    } catch (e) {
      console.error('Failed to save splash state', e);
    }
  };

  const finishIntro = async () => {
    try {
      await AsyncStorage.setItem(INTRO_KEY, 'true');
      setIsIntroDone(true);
    } catch (e) {
      console.error('Failed to save intro state', e);
    }
  };

  const activateBusiness = async () => {
    try {
      await AsyncStorage.setItem(ACTIVATE_KEY, 'true');
      setIsActivated(true);
    } catch (e) {
      console.error('Failed to save activation state', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isSplashDone,
        isIntroDone,
        isActivated,
        isLoading,
        signIn,
        signOut,
        finishSplash,
        finishIntro,
        activateBusiness,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
