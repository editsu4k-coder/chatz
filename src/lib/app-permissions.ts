// The three OS permissions ChatZ needs for its core features. All checks read the
// real Android state — never a cached or assumed one — so the UI can't claim a
// grant that was revoked in system settings.
import { Capacitor } from "@capacitor/core";
import { VibeStats } from "./vibe-stats";

export type PermKey = "usage" | "notifs" | "background";

export type PermState = Record<PermKey, boolean>;

export type PermMeta = {
  id: PermKey;
  label: string;
  purpose: string;
  howTo: string;
};

export const REQUIRED_PERMS: PermMeta[] = [
  {
    id: "usage",
    label: "Screen-time access",
    purpose: "Reads your real daily phone usage so your stats and your friends' stats work.",
    howTo: "Usage access → ChatZ → allow",
  },
  {
    id: "notifs",
    label: "Notifications",
    purpose: "Delivers friend requests, reactions, comments and message alerts.",
    howTo: "Notifications → ChatZ → allow",
  },
  {
    id: "background",
    label: "Background activity",
    purpose: "Stops Android from freezing ChatZ so your screen-time keeps syncing.",
    howTo: "Battery → ChatZ → don't optimize / allow background activity",
  },
];

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function checkPerm(id: PermKey): Promise<boolean> {
  if (!isNativeApp()) return true;
  try {
    if (id === "usage") return Boolean((await VibeStats.checkUsageAccess()).granted);
    if (id === "background") return Boolean((await VibeStats.checkBatteryOptimization()).granted);
    return Boolean((await VibeStats.checkPermission({ action: "notifs" })).granted);
  } catch {
    return false;
  }
}

export async function checkAllPerms(): Promise<PermState> {
  const [usage, notifs, background] = await Promise.all([
    checkPerm("usage"),
    checkPerm("notifs"),
    checkPerm("background"),
  ]);
  return { usage, notifs, background };
}

export function allPermsGranted(s: PermState): boolean {
  return s.usage && s.notifs && s.background;
}

/** Opens the Android settings screen that controls this specific permission. */
export async function openPermSettings(id: PermKey): Promise<void> {
  if (!isNativeApp()) return;
  if (id === "usage") return VibeStats.requestUsageAccess();
  if (id === "background") return VibeStats.requestBatteryOptimization();
  await VibeStats.requestPermission({ action: "notifs" });
}
