import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, FONTS, useTheme } from '../config';

type AppModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  iconName?: string;
};

export const AppModal: React.FC<AppModalProps> = ({ 
  visible, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel',
  confirmColor,
  iconName = 'logout',
}) => {
  const { colors } = useTheme();
  
  // Default to dynamic primary color if no specific color is supplied
  const finalConfirmColor = confirmColor || colors.brand;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalContainer, { backgroundColor: colors.cardGlass, borderColor: colors.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: colors.brandSoft }]}>
                <Icon name={iconName} size={30} color={finalConfirmColor} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.message, { color: colors.subText }]}>{message}</Text>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.button, styles.cancelButton, { backgroundColor: colors.raisedSurface, borderColor: colors.border }]} 
                  onPress={onClose}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text }]}>{cancelLabel}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.button, styles.confirmButton, { backgroundColor: finalConfirmColor }]} 
                  onPress={onConfirm}
                >
                  <Text style={[styles.confirmButtonText, { color: colors.onBrand }]}>{confirmLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalContainer: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowColor: COLORS.light.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 12,
  },
  iconWrap: {
    width: 66,
    height: 66,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 21,
    fontFamily: FONTS.bold,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  confirmButton: {
    // Background color set dynamically via props
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
  confirmButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
  },
});
