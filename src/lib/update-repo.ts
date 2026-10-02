/**
 * Update repository — type-safe wrapper around native Capacitor update plugin.
 *
 * This module bridges JavaScript/TypeScript to the native Android UpdateManager
 * via the Capacitor UpdatePlugin, providing strongly-typed interfaces and
 * convenience methods for the React UI layer.
 */

import { registerPlugin } from "@capacitor/core";

interface UpdatePluginInterface {
  checkForUpdates(options: { force: boolean }): Promise<any>;
  downloadApk(options: { url: string }): Promise<any>;
  verifyChecksum(options: { apkPath: string; sha256: string }): Promise<any>;
  installApk(options: { apkPath: string }): Promise<any>;
  canInstallUnknownApps(): Promise<any>;
  openInstallPermissionSettings(): Promise<void>;
  getLastNotifiedVersion(): Promise<any>;
  setLastNotifiedVersion(options: { versionCode: number }): Promise<void>;
  clearCache(): Promise<void>;
  startRealtimeListener(): Promise<any>;
  stopRealtimeListener(): Promise<void>;
  addListener(eventName: string, listenerFunc: (data: any) => void): Promise<any>;
  removeAllListeners(): Promise<void>;
}

const UpdatePlugin = registerPlugin<UpdatePluginInterface>("UpdatePlugin");

/**
 * Update check result from native layer.
 */
export interface UpdateCheckResult {
  status: "up_to_date" | "optional_update" | "mandatory_update" | "check_failed";
  hasUpdate: boolean;
  isMandatory?: boolean;
  updateInfo?: UpdateInfo;
  error?: string;
}

/**
 * Update metadata payload.
 */
export interface UpdateInfo {
  latestVersionCode: number;
  latestVersionName: string;
  downloadUrl: string;
  sha256: string;
  title: string;
  description: string;
  releaseDate: string;
  changes: string[];
  isMandatory: boolean;
}

/**
 * Download progress callback type.
 */
export type DownloadProgressCallback = (progress: number) => void;

/**
 * Download result from native layer.
 */
export interface DownloadResult {
  success: boolean;
  apkPath?: string;
  error?: string;
}

/**
 * Checksum verification result.
 */
export interface ChecksumResult {
  valid: boolean;
  error?: string;
}

/**
 * Install permission check result.
 */
export interface InstallPermissionResult {
  canInstall: boolean;
  needsPermission: boolean;
}

/**
 * Check for updates with optional force flag to bypass cooldown cache.
 *
 * @param force - If true, bypasses 6-hour cooldown (used for manual checks)
 * @returns UpdateCheckResult with current status and metadata if available
 */
export async function checkForUpdates(force = false): Promise<UpdateCheckResult> {
  try {
    const result = await UpdatePlugin.checkForUpdates({ force });
    return result as UpdateCheckResult;
  } catch (error) {
    console.error("Update check failed:", error);
    return {
      status: "check_failed",
      hasUpdate: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Download APK file from provided URL with progress callbacks.
 *
 * @param url - HTTPS download URL from update metadata
 * @param onProgress - Optional callback for download progress (0-100)
 * @returns DownloadResult with APK path on success
 */
export async function downloadApk(
  url: string,
  onProgress?: DownloadProgressCallback
): Promise<DownloadResult> {
  try {
    // Set up progress listener if callback provided
    if (onProgress) {
      UpdatePlugin.addListener("downloadProgress", (data: any) => {
        const progress = (data as { progress?: number }).progress ?? 0;
        onProgress(progress);
      });
    }

    const result = await UpdatePlugin.downloadApk({ url });
    return result as DownloadResult;
  } catch (error) {
    console.error("APK download failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  } finally {
    // Clean up listener
    if (onProgress) {
      UpdatePlugin.removeAllListeners();
    }
  }
}

/**
 * Verify SHA-256 checksum of downloaded APK against expected hash.
 *
 * @param apkPath - Local file path to downloaded APK
 * @param sha256 - Expected SHA-256 hash from update metadata
 * @returns ChecksumResult indicating validity
 */
export async function verifyChecksum(
  apkPath: string,
  sha256: string
): Promise<ChecksumResult> {
  try {
    const result = await UpdatePlugin.verifyChecksum({ apkPath, sha256 });
    return result as ChecksumResult;
  } catch (error) {
    console.error("Checksum verification failed:", error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Install APK using Android PackageInstaller API.
 * Triggers system install prompt with proper FileProvider content URI.
 *
 * @param apkPath - Local file path to verified APK
 * @returns Success indicator
 */
export async function installApk(apkPath: string): Promise<{ success: boolean }> {
  try {
    const result = await UpdatePlugin.installApk({ apkPath });
    return result as { success: boolean };
  } catch (error) {
    console.error("APK installation failed:", error);
    return { success: false };
  }
}

/**
 * Check if app has permission to install unknown apps (Android 8+).
 *
 * @returns InstallPermissionResult with permission state
 */
export async function checkInstallPermission(): Promise<InstallPermissionResult> {
  try {
    const result = await UpdatePlugin.canInstallUnknownApps();
    return result as InstallPermissionResult;
  } catch (error) {
    console.error("Permission check failed:", error);
    return { canInstall: false, needsPermission: true };
  }
}

/**
 * Open system settings to grant INSTALL_UNKNOWN_APPS permission.
 * Navigates user to appropriate settings screen based on Android version.
 */
export async function openInstallPermissionSettings(): Promise<void> {
  try {
    await UpdatePlugin.openInstallPermissionSettings();
  } catch (error) {
    console.error("Failed to open settings:", error);
  }
}

/**
 * Get last notified version code to prevent duplicate notifications.
 *
 * @returns Version code that was last used for notification (0 if never)
 */
export async function getLastNotifiedVersion(): Promise<number> {
  try {
    const result = await UpdatePlugin.getLastNotifiedVersion();
    return (result as { versionCode: number }).versionCode ?? 0;
  } catch (error) {
    console.error("Failed to get last notified version:", error);
    return 0;
  }
}

/**
 * Record that notification was shown for a specific version.
 *
 * @param versionCode - Version code that triggered notification
 */
export async function setLastNotifiedVersion(versionCode: number): Promise<void> {
  try {
    await UpdatePlugin.setLastNotifiedVersion({ versionCode });
  } catch (error) {
    console.error("Failed to set last notified version:", error);
  }
}

/**
 * Clear cached update metadata (bypasses 6-hour cooldown).
 * Used when user manually triggers "Check for updates".
 */
export async function clearUpdateCache(): Promise<void> {
  try {
    await UpdatePlugin.clearCache();
  } catch (error) {
    console.error("Failed to clear update cache:", error);
  }
}

/**
 * Start real-time Firestore listener for update metadata changes.
 * Calls onMetadataChanged callback whenever a new version is published.
 * Returns cleanup function to stop listening.
 */
export function listenForUpdates(
  onMetadataChanged: (metadata: {
    latestVersionCode: number;
    latestVersionName: string;
    isMandatory: boolean;
  }) => void
): () => void {
  let mounted = true;

  // Start native listener
  UpdatePlugin.startRealtimeListener()
    .then(() => {
      console.log("Real-time update listener started");
    })
    .catch((error) => {
      console.error("Failed to start real-time listener:", error);
    });

  // Subscribe to events
  const removeListener = UpdatePlugin.addListener("updateMetadataChanged", (data: any) => {
    if (!mounted) return;
    console.log("Update metadata changed:", data);
    onMetadataChanged({
      latestVersionCode: data.latestVersionCode ?? 0,
      latestVersionName: data.latestVersionName ?? "",
      isMandatory: data.isMandatory ?? false,
    });
  });

  // Return cleanup function
  return () => {
    mounted = false;
    removeListener.then((r) => r.remove()).catch(() => {});
    UpdatePlugin.stopRealtimeListener().catch(() => {});
  };
}

/**
 * Format duration in milliseconds to human-readable string.
 * Utility for displaying screen time in UI.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format bytes to human-readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
