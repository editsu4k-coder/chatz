// The single place that decides where a signed-in user belongs.
//
// Order of truth: Firebase Auth says WHO the user is, Firestore says WHETHER they
// have finished onboarding. The localStorage profile is only a cache, and is never
// allowed to answer either question on its own except when Firestore is unreachable
// and the cache belongs to the same uid.
import type { User } from "firebase/auth";
import { ensureNativeSession, signOut } from "./auth";
import { loadProfile } from "./profile-repo";
import { AVATAR_COLORS, readProfile, writeProfile, type Profile } from "./profile-store";

export type Session =
  /** No Firebase session. */
  | { state: "signed-out" }
  /** Signed in, Firestore says onboarding is not finished. */
  | { state: "onboarding"; user: User }
  /** Signed in with a completed profile — go straight to the app. */
  | { state: "ready"; user: User; profile: Profile }
  /** Signed in, but Firestore could not be reached and this device has no cache
   *  for this account. Neither routing choice would be safe. */
  | { state: "unknown"; user: User; error: unknown };

/** A blank profile for a brand new account. Never carries the Google photo. */
export function freshProfileShell(user: User, previous?: Profile | null): Profile {
  const mine = previous && previous.uid === user.uid ? previous : null;
  return {
    name: mine?.name || user.displayName?.trim() || "",
    handle: mine?.handle ?? "",
    color: mine?.color ?? AVATAR_COLORS[1],
    avatarId: mine?.avatarId,
    goalHours: mine?.goalHours ?? 4,
    theme: mine?.theme ?? "system",
    accent: mine?.accent ?? "blue",
    // The Google address is stored as metadata only — never as an identity key.
    email: user.email ?? undefined,
    uid: user.uid,
    hasOnboarded: false,
  };
}

export async function resolveSession(user: User | null): Promise<Session> {
  if (!user) return { state: "signed-out" };

  try {
    const { profile, completed } = await loadProfile(user.uid);

    if (completed && profile) {
      writeProfile(profile);
      await ensureNativeSession(user).catch(() => {});
      return { state: "ready", user, profile };
    }

    // Firestore answered: there is no completed profile for this uid.
    const shell = freshProfileShell(user, readProfile());
    writeProfile(shell);
    await ensureNativeSession(user).catch(() => {});
    return { state: "onboarding", user };
  } catch (error) {
    // Retry: route on the cache for this same uid rather than risk showing
    // onboarding to someone who already completed it.
    const cached = readProfile();
    if (cached?.uid === user.uid) {
      await ensureNativeSession(user).catch(() => {});
      return cached.hasOnboarded
        ? { state: "ready", user, profile: cached }
        : { state: "onboarding", user };
    }
    return { state: "unknown", user, error };
  }
}

/** Sign out of both Firebase instances and drop the cached profile. */
export async function signOutEverywhere(): Promise<void> {
  try {
    await signOut();
  } finally {
    writeProfile(null);
  }
}
