// Screen-time snapshots and live presence.
//
//   usageStats/{uid}   the 15-minute WorkManager snapshot, written by the native sync
//                      and read by the owner plus their friends
//   presence/{uid}     foreground/background state, written by the app shell
//
// Both live outside users/{uid} on purpose: they change constantly and must never be
// written into the permanent profile document.
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { db } from "./firebase";
import { VibeStats } from "./vibe-stats";
import type { Privacy } from "./profile-store";
import { incrementRead, incrementWrite, incrementListenerRegistration, incrementListenerRemoval } from "./debug-firebase-counter";

/** One row of the shared "most used apps" summary. Deliberately no icon data. */
export type UsageAppStat = {
  packageName: string;
  appName: string;
  usageMs: number;
};

/** Which categories a snapshot carries. Gated categories are zeroed at write
 *  time, so the UI must leave them out entirely rather than render a fake zero. */
export type SharedFlags = {
  screenTime: boolean;
  topApps: boolean;
  dataUsage: boolean;
  wifi: boolean;
  battery: boolean;
  launches: boolean;
  notifications: boolean;
  deviceInfo: boolean;
};

export const ALL_SHARED: SharedFlags = {
  screenTime: true,
  topApps: true,
  dataUsage: true,
  wifi: true,
  battery: true,
  launches: true,
  notifications: true,
  deviceInfo: true,
};

export type UsageStats = {
  uid: string;
  /** Local date (YYYY-MM-DD) the snapshot describes. */
  day: string | null;
  syncedAt: string | null;
  screenTimeTodayMs: number;
  launchCount: number;
  notificationCount: number;
  deviceModel: string;
  androidVersion: string;
  topApps: UsageAppStat[];
  wifiDataUsedBytes: number;
  mobileDataUsedBytes: number;
  isOnWifi: boolean;
  isOnMobile: boolean;
  maskedSsid: string;
  batteryPercent: number;
  isCharging: boolean;
  /** Absent on snapshots written before sharing flags existed — then all is shared. */
  shared: SharedFlags;
  /**
   * Sharing mode the snapshot was written under. "silent" means the owner paused
   * sharing: every value in the document is already neutral, and the friend side
   * must show "Stats sharing is paused" rather than an empty stat sheet.
   */
  mode: "active" | "silent";
};

export type Presence = {
  online: boolean;
  lastSeen: string | null;
  deviceActive: boolean;
};

const USAGE_STATS = "usageStats";
const PRESENCE = "presence";

/** A device that stopped reporting reads as offline rather than permanently online. */
const PRESENCE_STALE_MS = 2 * 60 * 1000;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function asIso(v: unknown): string | null {
  const t = v as { toDate?: () => Date } | null;
  if (t && typeof t.toDate === "function") return t.toDate().toISOString();
  return typeof v === "string" && v ? v : null;
}

function parseShared(v: unknown): SharedFlags {
  const o = (v ?? {}) as Record<string, unknown>;
  // `!== false` on purpose: a missing key (older snapshot, or a field added
  // later) means shared, so an older document is never misread as unshared.
  const on = (k: string) => o[k] !== false;
  return {
    screenTime: on("screenTime"),
    topApps: on("topApps"),
    dataUsage: on("dataUsage"),
    wifi: on("wifi"),
    battery: on("battery"),
    launches: on("launches"),
    notifications: on("notifications"),
    deviceInfo: on("deviceInfo"),
  };
}

/** Local calendar day — screen time "today" is a local-day concept. */
export function localDay(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseUsage(uid: string, d: Record<string, unknown>): UsageStats {
  const day = asString(d.day) || null;
  const isToday = day === localDay();
  const rawApps = Array.isArray(d.topApps) ? (d.topApps as Array<Record<string, unknown>>) : [];

  return {
    uid,
    day,
    syncedAt: asIso(d.syncedAt),
    screenTimeTodayMs: isToday ? asNumber(d.screenTimeTodayMs) : 0,
    launchCount: isToday ? asNumber(d.launchCount) : 0,
    notificationCount: isToday ? asNumber(d.notificationCount) : 0,
    deviceModel: asString(d.deviceModel),
    androidVersion: asString(d.androidVersion),
    topApps: rawApps.map((a) => ({
      packageName: asString(a.packageName),
      appName: asString(a.appName),
      usageMs: asNumber(a.usageMs),
    })),
    wifiDataUsedBytes: asNumber(d.wifiDataUsedBytes),
    mobileDataUsedBytes: asNumber(d.mobileDataUsedBytes),
    isOnWifi: d.isOnWifi === true,
    isOnMobile: d.isOnMobile === true,
    maskedSsid: asString(d.maskedSsid),
    batteryPercent: asNumber(d.batteryPercent),
    isCharging: d.isCharging === true,
    shared: parseShared(d.shared),
    mode: d.mode === "silent" ? "silent" : "active",
  };
}

/**
 * Read a snapshot. A snapshot written on an earlier day still counts as "synced"
 * (the timestamp is kept) but contributes no screen time to today.
 */
export async function fetchUsageStats(uid: string): Promise<UsageStats | null> {
  const snap = await getDoc(doc(db, USAGE_STATS, uid));
  if (!snap.exists()) return null;
  return parseUsage(uid, snap.data() as Record<string, unknown>);
}

/**
 * Pull a snapshot straight from the server, bypassing the local cache — the
 * friend-side "refresh". Returns the numbers AND the sharing mode as they stand
 * right now, even when an older cached copy would otherwise be served.
 */
export async function fetchUsageStatsFresh(uid: string): Promise<UsageStats | null> {
  const snap = await getDocFromServer(doc(db, USAGE_STATS, uid));
  if (!snap.exists()) return null;
  return parseUsage(uid, snap.data() as Record<string, unknown>);
}

/**
 * Live view of a user's snapshot. Fires immediately (null when the device has
 * never synced) and again on every write, so a friend's fresh numbers show up
 * without a re-login. `onError` reports a denied or failed subscription so the
 * UI can say "no access" instead of rendering an empty stat sheet.
 */
export function subscribeUsageStats(
  uid: string,
  cb: (stats: UsageStats | null) => void,
  onError?: (err: Error) => void,
): () => void {
  incrementListenerRegistration(`usageStats/${uid}`);
  const unsub = onSnapshot(
    doc(db, USAGE_STATS, uid),
    (snap) => {
      incrementRead("subscribeUsageStats");
      cb(snap.exists() ? parseUsage(uid, snap.data() as Record<string, unknown>) : null);
    },
    (err) => {
      onError?.(err);
    },
  );
  // Wrap the unsubscribe to track removals
  return () => {
    incrementListenerRemoval(`usageStats/${uid}`);
    unsub();
  };
}

function privacyToShared(p: Privacy): SharedFlags {
  return {
    screenTime: p.showScreenTime !== false,
    topApps: p.showTopApp !== false,
    dataUsage: p.showData !== false,
    wifi: p.showWifi !== false,
    battery: p.showBattery !== false,
    launches: p.showLaunches !== false,
    notifications: p.showNotifications !== false,
    deviceInfo: p.showDeviceInfo !== false,
  };
}

/**
 * Write a snapshot right now instead of waiting for the next periodic worker
 * run. Called on every privacy-toggle or mode change so a just-disabled field
 * cannot linger, readable by friends, until the worker happens to run.
 *
 * Silent mode writes a fully neutral document carrying mode:"silent" — the
 * friend side shows "Stats sharing is paused". Active mode collects live stats
 * and gates them by the sharing flags in the same pass.
 *
 * The Active flip must ALWAYS land: when Usage access is off or the collection
 * itself fails, a neutral active document (mode:"active", every shared flag
 * false) is written instead of bailing. Otherwise the friend-facing doc would
 * stay mode:"silent" forever and friends would see "paused" long after the
 * owner switched back — while the worker may never rescue it (no native
 * session, deferred jobs). Friends see the honest "not shared" state.
 *
 * Best-effort: returns false only when the write itself failed.
 */
export async function pushUsageSnapshot(
  uid: string,
  privacy: Privacy,
  mode: "active" | "silent",
): Promise<boolean> {
  if (!uid || !Capacitor.isNativePlatform()) return false;
  try {
    const shared = privacyToShared(privacy);
    const silent = mode === "silent";

    const { granted } = await VibeStats.checkUsageAccess();
    let data: Awaited<ReturnType<typeof VibeStats.collectStats>> | null = null;
    if (!silent && granted) {
      try {
        data = await VibeStats.collectStats();
      } catch {
        data = null;
      }
    }

    // Can we publish real numbers? Active + usage access granted + collection
    // succeeded. Anything less publishes the neutral document so a stale state
    // (paused / old numbers) never lingers where friends can read it.
    const canShare = !silent && granted && data !== null;

    const payload: Record<string, unknown> = {
      mode: silent ? "silent" : "active",
      day: localDay(),
      screenTimeTodayMs: canShare && shared.screenTime ? data!.screenTimeTodayMs : 0,
      launchCount: canShare && shared.launches ? data!.launchCount : 0,
      notificationCount: canShare && shared.notifications ? data!.notificationCount : 0,
      deviceModel: canShare && shared.deviceInfo ? data!.deviceModel : "",
      androidVersion: canShare && shared.deviceInfo ? data!.androidVersion : "",
      wifiDataUsedBytes: canShare && shared.dataUsage ? data!.wifiDataUsedBytes : 0,
      mobileDataUsedBytes: canShare && shared.dataUsage ? data!.mobileDataUsedBytes : 0,
      isOnWifi: canShare && shared.wifi && data!.isOnWifi === true,
      isOnMobile: canShare && shared.wifi && data!.isOnMobile === true,
      maskedSsid: canShare && shared.wifi ? data!.maskedSsid : "",
      batteryPercent: canShare && shared.battery ? data!.batteryPercent : 0,
      isCharging: canShare && shared.battery && data!.isCharging === true,
      topApps:
        canShare && shared.topApps
          ? data!.topApps.map((a) => ({
              packageName: a.packageName,
              appName: a.appName,
              usageMs: a.usageMs,
            }))
          : [],
      shared: silent
        ? SHARED_NONE
        : canShare
          ? shared
          : SHARED_NONE,
      syncedAt: serverTimestamp(),
    };

    await setDoc(doc(db, USAGE_STATS, uid), payload, { merge: true });
    incrementWrite("pushUsageSnapshot");
    return true;
  } catch {
    // The periodic worker retries; a failed immediate push is not user-visible.
    return false;
  }
}

/** Every category unshared — used for silent mode and for neutral active docs. */
const SHARED_NONE: SharedFlags = {
  screenTime: false,
  topApps: false,
  dataUsage: false,
  wifi: false,
  battery: false,
  launches: false,
  notifications: false,
  deviceInfo: false,
};

/** A presence document, degraded to offline once its heartbeat goes stale. */
function parsePresence(d: Record<string, unknown>): Presence {
  const lastSeen = asIso(d.lastSeen);
  const fresh = lastSeen !== null && Date.now() - new Date(lastSeen).getTime() < PRESENCE_STALE_MS;
  return {
    online: d.online === true && fresh,
    lastSeen,
    deviceActive: d.deviceActive === true && fresh,
  };
}

/** Read one person's presence. */
export async function fetchPresence(uid: string): Promise<Presence | null> {
  const snap = await getDoc(doc(db, PRESENCE, uid));
  if (!snap.exists()) return null;
  return parsePresence(snap.data() as Record<string, unknown>);
}

/** Presence for many uids. documentId() `in` queries are always indexed. */
export async function fetchPresenceMany(uids: string[]): Promise<Map<string, Presence>> {
  const out = new Map<string, Presence>();
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    if (chunk.length === 0) continue;
    const snap = await getDocs(query(collection(db, PRESENCE), where(documentId(), "in", chunk)));
    for (const d of snap.docs) out.set(d.id, parsePresence(d.data() as Record<string, unknown>));
  }
  return out;
}

/** Publish my own presence. Only ever called for the signed-in uid. */
export async function setPresence(uid: string, online: boolean): Promise<void> {
  if (!uid) return;
  await setDoc(
    doc(db, PRESENCE, uid),
    { online, deviceActive: online, lastSeen: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
  incrementWrite("setPresence");
}
