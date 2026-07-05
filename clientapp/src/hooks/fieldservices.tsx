import { useLocationTracker } from './uselocationtracker';
import { useRegisterDeviceToken } from './useregisterdevicetoken';

/**
 * Headless component mounted inside the authenticated app. Runs the background
 * field services (foreground location tracking + FCM device-token registration)
 * for the logged-in user. Renders nothing.
 */
export default function FieldServices() {
  useRegisterDeviceToken();
  useLocationTracker();
  return null;
}
