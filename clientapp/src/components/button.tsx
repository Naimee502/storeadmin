import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { COLORS, FONTS, useTheme } from '../config';

type AppButtonProps = {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
};

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  loading = false,
  disabled = false,
  variant = 'primary',
}) => {
  const { colors } = useTheme();

  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: colors.secondary,
        };
      case 'outline':
        return {
          backgroundColor: colors.transparent,
          borderWidth: 1,
          borderColor: colors.brand,
        };
      case 'primary':
      default:
        return {
          backgroundColor: colors.brand,
        };
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
        return {
          color: colors.brand,
        };
      case 'secondary':
        return {
          color: colors.text,
        };
      case 'primary':
      default:
        return {
          color: colors.onBrand,
        };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        style,
        (disabled || loading) && styles.disabled,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.brand : (variant === 'secondary' ? colors.text : colors.onBrand)} />
      ) : (
        <Text style={[
          styles.text,
          getTextStyle(),
          textStyle,
        ]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginVertical: 8,
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  text: {
    fontSize: 15,
    fontFamily: FONTS.bold,
  },
  disabled: {
    opacity: 0.5,
  },
});
