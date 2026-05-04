/**
 * System Information Tools
 * Provides device and system information using expo-device and platform APIs
 */

import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export interface SystemInfoResponse {
  platform: string;
  os: string;
  osVersion: string;
  deviceName: string | null;
  deviceModel: string | null;
  deviceBrand: string | null;
  manufacturer: string | null;
  deviceType: Device.DeviceType | null;
  isDevice: boolean;
  totalMemory: number | null;
}

export interface StorageInfoResponse {
  documentDirectory: string;
  cacheDirectory: string;
  totalDiskCapacity: number | null;
  freeDiskStorage: number | null;
}

export interface NetworkInfoResponse {
  isConnected: boolean;
  type: string;
}

/**
 * Get comprehensive system information
 */
export async function getSystemInfo(): Promise<SystemInfoResponse> {
  try {
    return {
      platform: Platform.OS,
      os: Platform.OS,
      osVersion: Platform.Version.toString(),
      deviceName: Device.deviceName,
      deviceModel: Device.modelName,
      deviceBrand: Device.brand,
      manufacturer: Device.manufacturer,
      deviceType: Device.deviceType,
      isDevice: Device.isDevice,
      totalMemory: Device.totalMemory,
    };
  } catch (error) {
    console.error('Get system info error:', error);
    return {
      platform: Platform.OS,
      os: Platform.OS,
      osVersion: Platform.Version.toString(),
      deviceName: null,
      deviceModel: null,
      deviceBrand: null,
      manufacturer: null,
      deviceType: null,
      isDevice: false,
      totalMemory: null,
    };
  }
}

/**
 * Get storage information
 */
export async function getStorageInfo(): Promise<StorageInfoResponse> {
  try {
    const [totalDiskCapacity, freeDiskStorage] = await Promise.all([
      FileSystem.getTotalDiskCapacityAsync(),
      FileSystem.getFreeDiskStorageAsync(),
    ]);

    return {
      documentDirectory: FileSystem.documentDirectory || '',
      cacheDirectory: FileSystem.cacheDirectory || '',
      totalDiskCapacity,
      freeDiskStorage,
    };
  } catch (error) {
    console.error('Get storage info error:', error);
    return {
      documentDirectory: FileSystem.documentDirectory || '',
      cacheDirectory: FileSystem.cacheDirectory || '',
      totalDiskCapacity: null,
      freeDiskStorage: null,
    };
  }
}

/**
 * Get platform-specific information
 */
export function getPlatformInfo(): {
  os: string;
  version: string;
  isWeb: boolean;
  isAndroid: boolean;
  isIOS: boolean;
  isTesting: boolean;
} {
  return {
    os: Platform.OS,
    version: Platform.Version.toString(),
    isWeb: Platform.OS === 'web',
    isAndroid: Platform.OS === 'android',
    isIOS: Platform.OS === 'ios',
    isTesting: Platform.isTesting || false,
  };
}

/**
 * Get device capabilities
 */
export async function getDeviceCapabilities(): Promise<{
  hasCamera: boolean;
  hasAudio: boolean;
  hasNotifications: boolean;
  hasLocation: boolean;
}> {
  // These would require permission checks in a real implementation
  // For now, return based on device type
  return {
    hasCamera: Device.isDevice || false,
    hasAudio: Device.isDevice || false,
    hasNotifications: Device.isDevice || false,
    hasLocation: Device.isDevice || false,
  };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return 'Unknown';
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get device type as human-readable string
 */
export function getDeviceTypeString(deviceType: Device.DeviceType | null): string {
  if (deviceType === null) return 'Unknown';

  switch (deviceType) {
    case Device.DeviceType.PHONE:
      return 'Phone';
    case Device.DeviceType.TABLET:
      return 'Tablet';
    case Device.DeviceType.DESKTOP:
      return 'Desktop';
    case Device.DeviceType.TV:
      return 'TV';
    default:
      return 'Unknown';
  }
}

/**
 * Get comprehensive system summary
 */
export async function getSystemSummary(): Promise<string> {
  const systemInfo = await getSystemInfo();
  const storageInfo = await getStorageInfo();
  const platformInfo = getPlatformInfo();

  const lines = [
    '=== System Information ===',
    `Platform: ${platformInfo.os.toUpperCase()}`,
    `OS Version: ${systemInfo.osVersion}`,
    `Device: ${systemInfo.deviceName || 'Unknown'}`,
    `Model: ${systemInfo.deviceModel || 'Unknown'}`,
    `Brand: ${systemInfo.deviceBrand || 'Unknown'}`,
    `Manufacturer: ${systemInfo.manufacturer || 'Unknown'}`,
    `Device Type: ${getDeviceTypeString(systemInfo.deviceType)}`,
    `Is Physical Device: ${systemInfo.isDevice ? 'Yes' : 'No (Emulator/Simulator)'}`,
    '',
    '=== Memory ===',
    `Total Memory: ${formatBytes(systemInfo.totalMemory)}`,
    '',
    '=== Storage ===',
    `Total Capacity: ${formatBytes(storageInfo.totalDiskCapacity)}`,
    `Free Space: ${formatBytes(storageInfo.freeDiskStorage)}`,
    `Document Directory: ${storageInfo.documentDirectory}`,
    `Cache Directory: ${storageInfo.cacheDirectory}`,
  ];

  return lines.join('\n');
}
