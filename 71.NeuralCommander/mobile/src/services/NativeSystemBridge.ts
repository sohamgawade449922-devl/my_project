/**
 * NativeSystemBridge
 * ==================
 * JavaScript wrapper around the Kotlin NeuralCommanderModule
 * native bridge.
 */
import {NativeModules, Platform} from 'react-native';

const {NeuralCommanderModule} = NativeModules;

const isAndroid = Platform.OS === 'android';

function requireAndroid(fnName: string) {
  if (!isAndroid || !NeuralCommanderModule) {
    return Promise.reject(
      new Error(`${fnName} is only available on Android with NeuralCommanderModule`),
    );
  }
  return null;
}

export const SystemBridge = {
  /**
   * Enable Focus Mode with a given lock difficulty (1–5).
   */
  enableFocusMode(difficulty: number): Promise<string> {
    const err = requireAndroid('enableFocusMode');
    if (err) return err;
    return NeuralCommanderModule.enableFocusMode(difficulty);
  },

  /**
   * Disable Focus Mode and release any app lock overlays.
   */
  disableFocusMode(): Promise<string> {
    const err = requireAndroid('disableFocusMode');
    if (err) return err;
    return NeuralCommanderModule.disableFocusMode();
  },

  /**
   * Lock a specific app with the given difficulty.
   * @param packageName  e.g. 'com.instagram.android'
   * @param difficulty   1–5
   */
  lockApp(packageName: string, difficulty: number): Promise<string> {
    const err = requireAndroid('lockApp');
    if (err) return err;
    return NeuralCommanderModule.lockApp(packageName, difficulty);
  },

  /**
   * Remove the active app lock overlay.
   */
  unlockApp(): Promise<string> {
    const err = requireAndroid('unlockApp');
    if (err) return err;
    return NeuralCommanderModule.unlockApp();
  },

  /**
   * Associate a backend userId with the native service.
   */
  setCurrentUser(userId: number): Promise<string> {
    const err = requireAndroid('setCurrentUser');
    if (err) return err;
    return NeuralCommanderModule.setCurrentUser(userId);
  },

  /**
   * Check system permission status.
   * Returns { canDrawOverlays, accessibilityEnabled, isDeviceAdmin }
   */
  checkPermissions(): Promise<{
    canDrawOverlays: boolean;
    accessibilityEnabled: boolean;
    isDeviceAdmin: boolean;
  }> {
    const err = requireAndroid('checkPermissions');
    if (err) return err;
    return NeuralCommanderModule.checkPermissions();
  },

  /**
   * Lock the device screen immediately (requires device admin).
   */
  lockScreen(): Promise<string> {
    const err = requireAndroid('lockScreen');
    if (err) return err;
    return NeuralCommanderModule.lockScreen();
  },
};
