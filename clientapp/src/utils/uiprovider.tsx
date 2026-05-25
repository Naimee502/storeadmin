import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Snackbar } from 'react-native-snackbar';
import { useToast } from 'react-native-toast-notifications';
import { AppLoader } from '../components/loader';
import { COLORS, useTheme } from '../config';

type UIContextType = {
  showLoader: (visible: boolean) => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning') => void;
  showSnackbar: (message: string, duration?: number) => void;
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { colors, isDark } = useTheme();

  const showLoader = (visible: boolean) => setLoading(visible);

  const showToast = (message: string, type: 'success' | 'danger' | 'warning' = 'success') => {
    toast.show(message, { type });
  };

  const showSnackbar = (message: string, duration: number = Snackbar.LENGTH_SHORT) => {
    Snackbar.show({
      text: message,
      duration: duration,
      backgroundColor: isDark ? colors.primary : colors.primary,
      textColor: isDark ? colors.white : colors.white,
    });
  };

  return (
    <UIContext.Provider value={{ showLoader, showToast, showSnackbar }}>
      {children}
      <AppLoader visible={loading} />
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
