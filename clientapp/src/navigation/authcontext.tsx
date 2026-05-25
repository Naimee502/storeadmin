import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INTRO_KEY = '@is_intro_done';

type AuthContextType = {
  isAuthenticated: boolean;
  isSplashDone: boolean;
  isIntroDone: boolean;
  isLoading: boolean;
  signIn: () => void;
  signOut: () => void;
  finishSplash: () => void;
  finishIntro: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = '@is_authenticated';
const SPLASH_KEY = '@is_splash_done';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSplashDone, setIsSplashDone] = useState(false);
  const [isIntroDone, setIsIntroDone] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const [authValue, splashValue, introValue] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEY),
          AsyncStorage.getItem(SPLASH_KEY),
          AsyncStorage.getItem(INTRO_KEY),
        ]);

        if (authValue === 'true') {
          setIsAuthenticated(true);
          setIsSplashDone(true);
          setIsIntroDone(true);
        } else {
          if (splashValue === 'true') {
            setIsSplashDone(true);
          }
          if (introValue === 'true') {
            setIsIntroDone(true);
          }
        }
      } catch (e) {
        console.error('Failed to load auth state', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadStorageData();
  }, []);

  const signIn = async () => {
    try {
      await AsyncStorage.setItem(AUTH_KEY, 'true');
      await AsyncStorage.setItem(SPLASH_KEY, 'true');
      await AsyncStorage.setItem(INTRO_KEY, 'true');
      setIsAuthenticated(true);
      setIsSplashDone(true);
      setIsIntroDone(true);
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

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isSplashDone,
        isIntroDone,
        isLoading,
        signIn,
        signOut,
        finishSplash,
        finishIntro,
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
