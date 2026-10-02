// Firebase Authentication. Google is the only sign-in method.
//
// There are two Firebase Auth instances in a ChatZ install: the JS SDK inside the
// WebView (this file) and the native Android SDK (used by the background sync
// worker). Both must be signed in as the same user, otherwise the worker has no
// UID to write under. `ensureNativeSession` is what keeps them in step.
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase";
import type { User } from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { VibeStats } from "./vibe-stats";

export type { User };

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/** Exact rejection message the native plugin uses when the picker is dismissed. */
const NATIVE_CANCELLED = "Google sign-in cancelled";

function isCancellation(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const message = err instanceof Error ? err.message : "";
  return (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    message === NATIVE_CANCELLED
  );
}

/**
 * Sign in with Google. Returns null when the user dismissed the account picker;
 * any real failure throws so the caller can show it.
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { idToken } = await VibeStats.signInWithGoogle();
      const result = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      return result.user;
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err) {
    if (isCancellation(err)) return null;
    throw err;
  }
}

/**
 * Sign out everywhere. Both instances are attempted even if the first one fails,
 * because a native instance left signed in would keep uploading as the old user.
 */
export async function signOut(): Promise<void> {
  const failures: unknown[] = [];

  if (Capacitor.isNativePlatform()) {
    try {
      await VibeStats.signOutNative();
    } catch (err) {
      failures.push(err);
    }
  }

  try {
    await firebaseSignOut(auth);
  } catch (err) {
    failures.push(err);
  }

  if (failures.length > 0) throw failures[0];
}

export async function getUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/** Turn a Firebase or native auth failure into something worth showing a user. */
export function authErrorMessage(err: unknown): string {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  const raw = err instanceof Error ? err.message : "";

  switch (code) {
    case "auth/network-request-failed":
      return "No connection. Check the network and try again.";
    case "auth/account-exists-with-different-credential":
      return "That email is already registered with a different sign-in method.";
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled for this project yet.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised in the Firebase console.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a little while.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    default:
      return raw || "Sign-in failed. Please try again.";
  }
}

/** The uid the native Firebase instance is signed in as, or "" if it is not. */
export async function getNativeAuthUid(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return "";
  try {
    const { uid } = await VibeStats.getNativeAuthUid();
    return uid;
  } catch {
    return "";
  }
}

/**
 * Make sure the native instance holds the same session as the JS one. Call this
 * whenever a user becomes signed in — including on cold start, where the JS SDK
 * restores its session from disk but the native instance may never have been
 * signed in at all.
 */
export async function ensureNativeSession(user: User): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if ((await getNativeAuthUid()) === user.uid) return;
  // The native SDK only accepts a Google-issued ID token and a restored session
  // cannot mint one, so the repair is a silent Google sign-in on the native side.
  await VibeStats.adoptExistingSession({ uid: user.uid, email: user.email ?? "" });
  // If that silent sign-in picked a different Google account, a native session
  // belonging to somebody else is worse than none: it would make the background
  // worker upload this device's data under the wrong uid. Drop it instead.
  if ((await getNativeAuthUid()) !== user.uid) {
    await VibeStats.signOutNative().catch(() => {});
  }
}
