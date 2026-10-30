import React from 'react';
import { Pressable, StyleSheet, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useWhatsappChatNumber } from '../apollo/hooks/adminsettings';

export const GENERAL_WHATSAPP_MESSAGE = 'Hello, I would like to know more about your products.';

export const productWhatsappMessage = (productName: string) =>
  `Hello, I'm interested in *${productName}*. Could you please share more details?`;

/**
 * Floating "Chat on WhatsApp" button (bottom-right).
 *
 * Opens WhatsApp with the business's WhatsApp Number (Settings → General) and
 * a ready-written message; the customer taps Send. Renders nothing when the
 * admin switched it off or saved no number.
 *
 * `bottom` is set by the screen so the button clears whatever that screen
 * already keeps at the bottom (e.g. Home's floating "View Cart" bar).
 */
export function WhatsAppChatButton({ message = GENERAL_WHATSAPP_MESSAGE, bottom = 20 }: { message?: string; bottom?: number }) {
  const number = useWhatsappChatNumber();
  if (!number) return null;

  const open = () => {
    const text = encodeURIComponent(message);
    // whatsapp:// opens the app directly; wa.me is the fallback (opens the
    // app via the browser, or WhatsApp's page if it isn't installed).
    Linking.openURL(`whatsapp://send?phone=${number}&text=${text}`)
      .catch(() => Linking.openURL(`https://wa.me/${number}?text=${text}`))
      .catch(() => {});
  };

  return (
    <Pressable
      onPress={open}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Chat with us on WhatsApp"
      style={({ pressed }) => [styles.fab, { bottom, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
    >
      <Icon name="whatsapp" size={30} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', right: 18, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#25D366', justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 8,
    zIndex: 50,
  },
});
