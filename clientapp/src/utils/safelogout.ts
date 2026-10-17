import { InteractionManager } from 'react-native';
import { logout } from '../store/slices';

let inFlight = false;

/**
 * Logout without the Android Fabric crash
 * ("Cannot remove child at index 0 … / FragmentManager is already executing transactions").
 *
 * The crash happened because the tree was torn down twice, back to back, while
 * the confirm modal / drawer were still animating closed:
 *   1. dispatch(logout()) → user=null → ProtectedNavigator swapped its screen
 *   2. signOut()          → root swapped Protected → Public
 * Now: wait for the modal + drawer close animations to finish, swap the root
 * ONCE (signOut), and only clear the Redux user after that tree is gone.
 */
export function safeLogout(dispatch: (a: any) => any, signOut: () => any | Promise<any>) {
  if (inFlight) return;
  inFlight = true;
  InteractionManager.runAfterInteractions(() => {
    // Modal fade + drawer slide are ~300 ms; let both fully finish.
    setTimeout(async () => {
      try {
        await signOut();
      } finally {
        setTimeout(() => {
          dispatch(logout());
          inFlight = false;
        }, 400);
      }
    }, 350);
  });
}
