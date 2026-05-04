import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export function triggerHapticFeedback(type: 'light' | 'medium' | 'heavy' = 'medium') {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    switch (type) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
    }
  }
}

export function triggerNotificationFeedback(type: 'Success' | 'Warning' | 'Error' = 'Success') {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    switch (type) {
      case 'Success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'Warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'Error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  }
}

export function isAndroid(): boolean {
  return Platform.OS === 'android';
}

export function isIOS(): boolean {
  return Platform.OS === 'ios';
}

export function isWeb(): boolean {
  return Platform.OS === 'web';
}

export function getAndroidVersion(): number | null {
  if (Platform.OS !== 'android') return null;
  return Platform.Version ?? null;
}

export const ANDROID_PERMISSIONS = {
  INTERNET: 'android.permission.INTERNET',
  READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
  WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
  CAMERA: 'android.permission.CAMERA',
  RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
  ACCESS_NETWORK_STATE: 'android.permission.ACCESS_NETWORK_STATE',
  CHANGE_NETWORK_STATE: 'android.permission.CHANGE_NETWORK_STATE',
};
