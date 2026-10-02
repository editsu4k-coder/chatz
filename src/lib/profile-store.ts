// Local cache of the signed-in user's own profile, plus theme handling.
//
// This is a CACHE, not an identity. Firestore (`users/{uid}`, see profile-repo.ts) is
// the source of truth; this file exists so the UI can paint instantly on cold start
// and work offline. Nothing here may be used to decide who the user is.
import { useEffect, useState } from "react";
import { graphemes } from "./text";

export type Theme = "light" | "dark" | "system";
export type Accent = "blue" | "purple" | "pink" | "green" | "orange" | "red";

export type Socials = {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  whatsapp?: string;
};

// Every field here is enforced twice: the app shell pushes these to the native
// worker (which zeroes gated fields at write time) and mirrors them to
// users/{uid}/private/data.privacy in Firestore — that document is owner-only,
// so a friend can never read a user's sharing configuration. `appearInSearch`
// is mirrored to the top-level `discoverable` boolean on the public profile,
// which search queries filter on server-side.
export type Privacy = {
  showScreenTime: boolean;
  showTopApp: boolean;
  showData: boolean;
  showWifi: boolean;
  showBattery: boolean;
  showLaunches: boolean;
  showNotifications: boolean;
  showDeviceInfo: boolean;
  appearInSearch: boolean;
};

export const DEFAULT_PRIVACY: Privacy = {
  showScreenTime: true,
  showTopApp: true,
  showData: false,
  showWifi: true,
  showBattery: true,
  showLaunches: true,
  showNotifications: true,
  showDeviceInfo: true,
  appearInSearch: true,
};

export type Profile = {
  name: string;
  handle: string;
  color: string;
  /** Bundled avatar asset id, e.g. "avatar_017". Never an image URL or base64 payload. */
  avatarId?: string;
  goalHours: number;
  theme: Theme;
  accent: Accent;
  firstName?: string;
  lastName?: string;
  bio?: string;
  age?: number;
  dob?: string;
  education?: string;
  /** Google account email — kept as metadata only, never used as an identity key. */
  email?: string;
  /** Firebase Auth UID. The one and only identity key across the whole app. */
  uid?: string;
  socials?: Socials;
  privacy?: Privacy;
  location?: string;
  /**
   * Sharing mode. "active" shares per the individual privacy toggles; "silent"
   * temporarily stops stat sharing without touching those toggles. Synced to
   * usageStats/{uid}.mode (friend-facing by design) and to native per-uid prefs.
   */
  mode?: "active" | "silent";
  /** Mirrors `profileCompleted` on users/{uid}. Drives the onboarding gate. */
  hasOnboarded?: boolean;
};

export function ageFromDob(dob?: string): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
  return a >= 0 ? a : undefined;
}

const KEY = "st-social:profile";

const ACCENTS: Record<Accent, { primary: string; ring: string }> = {
  blue:   { primary: "oklch(0.62 0.19 255)", ring: "oklch(0.62 0.19 255)" },
  purple: { primary: "oklch(0.58 0.23 295)", ring: "oklch(0.58 0.23 295)" },
  pink:   { primary: "oklch(0.66 0.22 350)", ring: "oklch(0.66 0.22 350)" },
  green:  { primary: "oklch(0.66 0.18 150)", ring: "oklch(0.66 0.18 150)" },
  orange: { primary: "oklch(0.72 0.18 50)",  ring: "oklch(0.72 0.18 50)" },
  red:    { primary: "oklch(0.62 0.23 25)",  ring: "oklch(0.62 0.23 25)" },
};

export const ACCENT_SWATCH: Record<Accent, string> = {
  blue: "#007AFF", purple: "#AF52DE", pink: "#FF2D55",
  green: "#34C759", orange: "#FF9500", red: "#FF3B30",
};

export const AVATAR_COLORS = [
  "#FF6B9D", "#5E72E4", "#22C55E", "#F59E0B",
  "#AF52DE", "#0EA5E9", "#EC4899", "#10B981",
  "#FB7185", "#6366F1", "#14B8A6", "#F97316",
];

/** Stable fallback colour derived from a handle, for profiles without one stored. */
export function colorForHandle(handle: string): string {
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function readProfile(): Profile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      theme: "system",
      accent: "blue",
      color: "#5E72E4",
      goalHours: 4,
      socials: {},
      mode: "active",
      ...parsed,
      privacy: { ...DEFAULT_PRIVACY, ...(parsed.privacy ?? {}) },
    } as Profile;
  } catch { return null; }
}

export function writeProfile(p: Profile | null) {
  if (typeof window === "undefined") return;
  if (p === null) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event("st-social:profile"));
  if (p) applyTheme(p);
}

export function applyTheme(p: Profile) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark =
    p.theme === "dark" ||
    (p.theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
  const accent = ACCENTS[p.accent] ?? ACCENTS.blue;
  root.style.setProperty("--primary", accent.primary);
  root.style.setProperty("--ring", accent.ring);
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    const p = readProfile();
    setProfile(p);
    if (p) applyTheme(p);
    const onChange = () => {
      const next = readProfile();
      setProfile(next);
      if (next) applyTheme(next);
    };
    window.addEventListener("st-social:profile", onChange);
    window.addEventListener("storage", onChange);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onChange);
    return () => {
      window.removeEventListener("st-social:profile", onChange);
      window.removeEventListener("storage", onChange);
      mq.removeEventListener("change", onChange);
    };
  }, []);
  return profile;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = graphemes(parts[0]);
  if (parts.length === 1) return first.slice(0, 2).join("").toUpperCase();
  const last = graphemes(parts[parts.length - 1]);
  return (first[0] + last[0]).toUpperCase();
}
