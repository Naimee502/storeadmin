import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, KeyboardTypeOptions, ViewStyle, TextStyle, TouchableOpacity, StyleProp } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { FONTS, useTheme } from '../config';

type AppTextInputProps = {
  label?: string;
  leftIcon?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  errorStyle?: StyleProp<TextStyle>;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  showEyeIcon?: boolean;
  /** Override the default (very light) placeholder tint — e.g. the Home
   *  and Shop search bars, which need a more legible hint over the
   *  card background. Defaults to `colors.placeholder`. */
  placeholderTextColor?: string;
};

export const AppTextInput: React.FC<AppTextInputProps> = ({
  label,
  leftIcon,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  error,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  autoCapitalize = 'sentences',
  showEyeIcon = false,
  placeholderTextColor,
}) => {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);
  const { colors } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.text }, labelStyle]}>
          {label}
        </Text>
      )}
      <View style={[
        styles.inputContainer,
        {
          borderColor: error
            ? colors.error
            : isFocused
            ? colors.brand
            : colors.border,
          backgroundColor: colors.secondary,
        },
        inputStyle
      ]}>
        {leftIcon && (
          <Icon
            name={leftIcon}
            size={18}
            color={isFocused ? colors.brand : colors.subText}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? colors.placeholder}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={isSecure}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {showEyeIcon && (
          <TouchableOpacity onPress={() => setIsSecure(!isSecure)} style={styles.eyeIcon}>
            <Icon
              name={isSecure ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={colors.subText}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[styles.error, { color: colors.error }, errorStyle]}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    marginBottom: 6,
    marginLeft: 6,
  },
  inputContainer: {
    borderWidth: 1,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    fontFamily: FONTS.regular,
  },
  eyeIcon: {
    marginLeft: 10,
  },
  leftIcon: {
    marginRight: 10,
  },
  error: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 15,
    fontFamily: FONTS.regular,
  },
});
