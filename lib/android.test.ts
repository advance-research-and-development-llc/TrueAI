import {
  triggerHapticFeedback,
  triggerNotificationFeedback,
  isAndroid,
  isIOS,
  isWeb,
  getAndroidVersion,
  ANDROID_PERMISSIONS,
} from './android';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

jest.mock('react-native');
jest.mock('expo-haptics');

describe('android.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('triggerHapticFeedback', () => {
    it('should trigger light haptic feedback on iOS', () => {
      (Platform as any).OS = 'ios';

      triggerHapticFeedback('light');

      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('should trigger medium haptic feedback on Android', () => {
      (Platform as any).OS = 'android';

      triggerHapticFeedback('medium');

      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    });

    it('should trigger heavy haptic feedback', () => {
      (Platform as any).OS = 'ios';

      triggerHapticFeedback('heavy');

      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
    });

    it('should default to medium intensity', () => {
      (Platform as any).OS = 'ios';

      triggerHapticFeedback();

      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
    });

    it('should not trigger on web platform', () => {
      (Platform as any).OS = 'web';

      triggerHapticFeedback('light');

      expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });
  });

  describe('triggerNotificationFeedback', () => {
    it('should trigger success notification on iOS', () => {
      (Platform as any).OS = 'ios';

      triggerNotificationFeedback('Success');

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });

    it('should trigger warning notification on Android', () => {
      (Platform as any).OS = 'android';

      triggerNotificationFeedback('Warning');

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Warning
      );
    });

    it('should trigger error notification', () => {
      (Platform as any).OS = 'ios';

      triggerNotificationFeedback('Error');

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Error
      );
    });

    it('should default to success notification', () => {
      (Platform as any).OS = 'ios';

      triggerNotificationFeedback();

      expect(Haptics.notificationAsync).toHaveBeenCalledWith(
        Haptics.NotificationFeedbackType.Success
      );
    });

    it('should not trigger on web platform', () => {
      (Platform as any).OS = 'web';

      triggerNotificationFeedback('Success');

      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('isAndroid', () => {
    it('should return true when platform is android', () => {
      (Platform as any).OS = 'android';

      expect(isAndroid()).toBe(true);
    });

    it('should return false when platform is iOS', () => {
      (Platform as any).OS = 'ios';

      expect(isAndroid()).toBe(false);
    });

    it('should return false when platform is web', () => {
      (Platform as any).OS = 'web';

      expect(isAndroid()).toBe(false);
    });
  });

  describe('isIOS', () => {
    it('should return true when platform is ios', () => {
      (Platform as any).OS = 'ios';

      expect(isIOS()).toBe(true);
    });

    it('should return false when platform is Android', () => {
      (Platform as any).OS = 'android';

      expect(isIOS()).toBe(false);
    });

    it('should return false when platform is web', () => {
      (Platform as any).OS = 'web';

      expect(isIOS()).toBe(false);
    });
  });

  describe('isWeb', () => {
    it('should return true when platform is web', () => {
      (Platform as any).OS = 'web';

      expect(isWeb()).toBe(true);
    });

    it('should return false when platform is iOS', () => {
      (Platform as any).OS = 'ios';

      expect(isWeb()).toBe(false);
    });

    it('should return false when platform is Android', () => {
      (Platform as any).OS = 'android';

      expect(isWeb()).toBe(false);
    });
  });

  describe('getAndroidVersion', () => {
    it('should return Android version number', () => {
      (Platform as any).OS = 'android';
      (Platform as any).Version = 30;

      expect(getAndroidVersion()).toBe(30);
    });

    it('should return null when not on Android', () => {
      (Platform as any).OS = 'ios';

      expect(getAndroidVersion()).toBeNull();
    });

    it('should return null when version is not available', () => {
      (Platform as any).OS = 'android';
      (Platform as any).Version = undefined;

      expect(getAndroidVersion()).toBeNull();
    });
  });

  describe('ANDROID_PERMISSIONS', () => {
    it('should have all required permissions defined', () => {
      expect(ANDROID_PERMISSIONS.INTERNET).toBe('android.permission.INTERNET');
      expect(ANDROID_PERMISSIONS.READ_EXTERNAL_STORAGE).toBe(
        'android.permission.READ_EXTERNAL_STORAGE'
      );
      expect(ANDROID_PERMISSIONS.WRITE_EXTERNAL_STORAGE).toBe(
        'android.permission.WRITE_EXTERNAL_STORAGE'
      );
      expect(ANDROID_PERMISSIONS.CAMERA).toBe('android.permission.CAMERA');
      expect(ANDROID_PERMISSIONS.RECORD_AUDIO).toBe('android.permission.RECORD_AUDIO');
      expect(ANDROID_PERMISSIONS.ACCESS_NETWORK_STATE).toBe(
        'android.permission.ACCESS_NETWORK_STATE'
      );
      expect(ANDROID_PERMISSIONS.CHANGE_NETWORK_STATE).toBe(
        'android.permission.CHANGE_NETWORK_STATE'
      );
    });


    it('should have permission strings in correct format', () => {
      Object.values(ANDROID_PERMISSIONS).forEach((permission) => {
        expect(permission).toMatch(/^android\.permission\./);
      });
    });
  });
});
