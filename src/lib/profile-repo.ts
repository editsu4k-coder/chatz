// Firestore profile repository — the single source of truth for who a user is.
//
//   users/{uid}                public profile + onboarding gate (profileCompleted)
//   users/{uid}/private/data   email, date of birth, education (owner-only)
//   handles/{handleLower}      { uid, createdAt } — the handle reservation lock
//
// The document ID is always the Firebase Auth UID. Email, display name and handle
// are never used as identity keys.
import {
  collection,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  where,
  writeBatch,
} from "firebase/firestore";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import {
  AVATAR_COLORS,
  DEFAULT_PRIVACY,
  ageFromDob,
  colorForHandle,
  type Accent,
  type Privacy,
  type Profile,
  type Socials,
  type Theme,
} from "./profile-store";
import { handleProblem, normalizeHandle } from "./handle";
import { BIO_MAX, clampGraphemes, cleanBio, cleanName, nameProblem } from "./text";

export const USERS_COLLECTION = "users";
export const HANDLES_COLLECTION = "handles";
const PRIVATE_SUBCOLLECTION = "private";
const PRIVATE_DOC = "data";

/** The subset of a profile that anyone signed in may read. */
export type PublicProfile = {
  uid: string;
  name: string;
  handle: string;
  color: string;
  avatarId?: string;
  /** Optional short bio shown on the profile page. */
  bio?: string;
  /** Consecutive days the user has opened ChatZ. Written by bumpStreak on launch. */
  streak?: number;
  /** Optional social links (instagram, x, github, website). */
  socials?: Socials;
};

export class HandleTakenError extends Error {
  constructor(handle: string) {
    super(`@${handle} is already taken.`);
    this.name = "HandleTakenError";
  }
}

/** Firestore reports an unreachable backend as "unavailable". */
export function isOfflineError(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  return code === "unavailable" || code === "deadline-exceeded";
}

export type LoadedProfile = {
  /** null means Firestore definitively has no profile document for this uid. */
  profile: Profile | null;
  /** true only when users/{uid}.profileCompleted === true. */
  completed: boolean;
};

export type ProfileDraft = {
  /** Display name, as typed. */
  name: string;
  /** Handle as typed — normalised before it is stored or reserved. */
  handle: string;
  avatarId?: string;
  color: string;
  goalHours: number;
  bio?: string;
  /** Private fields. */
  firstName?: string;
  lastName?: string;
  dob?: string;
  education?: string;
  /** Google account email. Metadata only, never an identity key. */
  email?: string;
};

/** Partial update. Deliberately excludes handle, uid and profileCompleted:
 *  the first is a reserved resource with its own transaction, the other two are
 *  immutable. */
export type ProfilePatch = {
  name?: string;
  color?: string;
  avatarId?: string;
  goalHours?: number;
  bio?: string;
  location?: string;
  theme?: Theme;
  accent?: Accent;
  socials?: Socials;
  privacy?: Privacy;
  mode?: "active" | "silent";
  dob?: string;
  education?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

const USERS = collection(db, USERS_COLLECTION);

function profileRef(uid: string) {
  return doc(db, USERS_COLLECTION, uid);
}

function privateRef(uid: string) {
  return doc(db, USERS_COLLECTION, uid, PRIVATE_SUBCOLLECTION, PRIVATE_DOC);
}

function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function toPublicProfile(snap: QueryDocumentSnapshot | { id: string; data: () => Record<string, unknown> }): PublicProfile {
  const d = snap.data() as Record<string, unknown>;
  const handle = asString(d.handle);
  const socials = (d.socials ?? {}) as Socials;
  const hasSocials = Object.values(socials).some((v) => typeof v === "string" && v.length > 0);
  return {
    uid: snap.id,
    name: asString(d.name) || handle,
    handle,
    color: asString(d.color) || colorForHandle(handle || snap.id),
    avatarId: (d.avatarId as string) ?? undefined,
    bio: asString(d.bio) || undefined,
    streak: asNumber(d.streak),
    socials: hasSocials ? socials : undefined,
  };
}

// ------------------------------------------------------------------ handles

/**
 * Reserve a handle for `uid`. The reservation document is its own transaction:
 * `create` fails natively if the handle exists, so two people racing for the
 * same handle can never both win. Re-claiming your own handle is a no-op.
 */
export async function claimHandle(rawHandle: string, uid: string): Promise<string> {
  const problem = handleProblem(rawHandle);
  if (problem) throw new Error(problem);
  const handle = normalizeHandle(rawHandle);
  const ref = doc(db, HANDLES_COLLECTION, handle);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      if (asString(snap.data()?.uid) !== uid) throw new HandleTakenError(handle);
      return;
    }
    tx.set(ref, { uid, createdAt: serverTimestamp() });
  });

  return handle;
}

/** Give up a handle reservation. Only ever removes the caller's own document. */
export async function releaseHandle(rawHandle: string, uid: string): Promise<void> {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return;
  const ref = doc(db, HANDLES_COLLECTION, handle);
  const snap = await getDoc(ref);
  if (snap.exists() && asString(snap.data().uid) === uid) await deleteDoc(ref);
}

/** True when the handle is free or already reserved by `uid`. */
export async function isHandleAvailable(rawHandle: string, uid: string): Promise<boolean> {
  const problem = handleProblem(rawHandle);
  if (problem) return false;
  const snap = await getDoc(doc(db, HANDLES_COLLECTION, normalizeHandle(rawHandle)));
  return !snap.exists() || asString(snap.data()?.uid) === uid;
}

// ----------------------------------------------------------------- profiles

/**
 * Read a profile. Returns null profile when Firestore has no document for the
 * uid — that is the ONLY signal that a user has never onboarded. Network and
 * permission failures throw instead, so a returning user is never mistaken for
 * a new one just because the device was offline.
 */
export async function loadProfile(uid: string): Promise<LoadedProfile> {
  const [pubSnap, privSnap] = await Promise.all([getDoc(profileRef(uid)), getDoc(privateRef(uid))]);
  if (!pubSnap.exists()) return { profile: null, completed: false };

  const d = pubSnap.data() as Record<string, unknown>;
  const p = (privSnap.data() ?? {}) as Record<string, unknown>;
  const handle = asString(d.handle);
  const dob = asString(p.dob) || undefined;

  // Privacy lives on the owner-only private document. Documents written before
  // that move still carry the map on the public one — honour it once, then
  // migrate it away below so friends can never read the sharing configuration.
  const legacyPrivacy = d.privacy as Privacy | undefined;
  const privacy = (p.privacy as Privacy | undefined) ?? legacyPrivacy;
  const effectivePrivacy: Privacy = { ...DEFAULT_PRIVACY, ...(privacy ?? {}) };

  const profile: Profile = {
    uid,
    name: asString(d.name),
    handle,
    color: asString(d.color) || colorForHandle(handle || uid),
    avatarId: (d.avatarId as string) ?? undefined,
    goalHours: asNumber(d.goalHours) ?? 4,
    theme: (d.theme as Theme) ?? "system",
    accent: (d.accent as Accent) ?? "blue",
    bio: asString(d.bio) || undefined,
    location: asString(d.location) || undefined,
    socials: (d.socials as Socials) ?? {},
    privacy: effectivePrivacy,
    mode: (p.mode as Profile["mode"]) ?? "active",
    email: asString(p.email) || undefined,
    firstName: asString(p.firstName) || undefined,
    lastName: asString(p.lastName) || undefined,
    dob,
    education: asString(p.education) || undefined,
    age: ageFromDob(dob),
    hasOnboarded: d.profileCompleted === true,
  };

  migratePrivacy(uid, d, p, effectivePrivacy).catch(() => {
    /* Migration is best-effort; the next boot retries. */
  });

  return { profile, completed: d.profileCompleted === true };
}

/**
 * One-time cleanup of documents that predate the private-privacy design:
 *  - `privacy` moves from the public profile to `private/data`
 *  - `discoverable` (the search-gate field) is seeded from the effective map
 *
 * Mode is deliberately NOT written here: this runs un-awaited from loadProfile
 * against a possibly-stale snapshot, and writing `mode: x ?? "active"` from it
 * could clobber a Silent the user just set (the silent→active flip bug). Mode
 * is owned exclusively by user actions via syncLocalProfile/updateProfile —
 * absence simply means "never configured", which reads as active.
 */
async function migratePrivacy(
  uid: string,
  pub: Record<string, unknown>,
  priv: Record<string, unknown>,
  effective: Privacy,
): Promise<void> {
  const privateNeedsPrivacy = priv.privacy === undefined;
  const publicHasLegacy = pub.privacy !== undefined;
  const publicNeedsDiscoverable = typeof pub.discoverable !== "boolean";
  if (!privateNeedsPrivacy && !publicHasLegacy && !publicNeedsDiscoverable) return;

  const batch = writeBatch(db);
  if (privateNeedsPrivacy || publicHasLegacy) {
    batch.set(privateRef(uid), { privacy: effective }, { merge: true });
  }
  if (publicHasLegacy) batch.set(profileRef(uid), { privacy: deleteField() }, { merge: true });
  if (publicNeedsDiscoverable) {
    batch.set(profileRef(uid), { discoverable: effective.appearInSearch !== false }, { merge: true });
  }
  await batch.commit();
}

/**
 * Create or replace the profile produced by onboarding. Claims the handle first
 * (committed on its own, which is what lets the profile rules verify ownership
 * with a plain get()), then writes the profile and private documents together.
 * Returns the handle exactly as it was stored.
 */
export async function saveOnboardingProfile(uid: string, draft: ProfileDraft): Promise<string> {
  // The same grapheme-safe rules the UI enforces — this is the last gate before
  // the text reaches Firestore.
  const name = cleanName(draft.name);
  const problem = nameProblem(name);
  if (problem) throw new Error(problem);

  const previous = await getDoc(profileRef(uid));
  const previousHandle = previous.exists() ? asString(previous.data().handle) : "";

  const handleLower = await claimHandle(draft.handle, uid);
  const handle = draft.handle.trim().replace(/^@+/, "");

  const batch = writeBatch(db);
  batch.set(
    profileRef(uid),
    {
      name,
      nameLower: nameKey(name),
      handle,
      handleLower,
      color: draft.color,
      avatarId: draft.avatarId ?? null,
      goalHours: draft.goalHours,
      bio: draft.bio ? clampGraphemes(cleanBio(draft.bio), BIO_MAX) : "",
      // Seeded here so migratePrivacy() never has to run for this account —
      // its un-awaited write is the window where a stale snapshot could
      // clobber fresh privacy/mode values.
      discoverable: true,
      profileCompleted: true,
      createdAt: previous.exists() ? (previous.data().createdAt ?? serverTimestamp()) : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    privateRef(uid),
    {
      email: draft.email ?? null,
      firstName: cleanName(draft.firstName ?? "") || null,
      lastName: cleanName(draft.lastName ?? "") || null,
      dob: draft.dob ?? null,
      education: draft.education ?? null,
    },
    { merge: true },
  );
  await batch.commit();

  if (previousHandle && normalizeHandle(previousHandle) !== handleLower) {
    await releaseHandle(previousHandle, uid).catch(() => {
      /* A stale reservation is harmless; it must not fail onboarding. */
    });
  }

  return handle;
}

/** Merge a partial update. Never touches handle, uid or profileCompleted. */
export async function updateProfile(uid: string, patch: ProfilePatch): Promise<void> {
  const pub: Record<string, unknown> = { updatedAt: serverTimestamp() };
  const priv: Record<string, unknown> = {};

  if (patch.name !== undefined) {
    const name = cleanName(patch.name);
    const problem = nameProblem(name);
    if (problem) throw new Error(problem);
    pub.name = name;
    pub.nameLower = nameKey(name);
  }
  if (patch.color !== undefined) pub.color = patch.color;
  if (patch.avatarId !== undefined) pub.avatarId = patch.avatarId;
  if (patch.goalHours !== undefined) pub.goalHours = patch.goalHours;
  if (patch.bio !== undefined) pub.bio = clampGraphemes(cleanBio(patch.bio), BIO_MAX);
  if (patch.location !== undefined) pub.location = patch.location;
  if (patch.theme !== undefined) pub.theme = patch.theme;
  if (patch.accent !== undefined) pub.accent = patch.accent;
  if (patch.socials !== undefined) pub.socials = patch.socials;

  // Privacy is owner-only: it lives on the private document. The public profile
  // carries only `discoverable`, the single boolean search queries filter on.
  if (patch.privacy !== undefined) {
    priv.privacy = patch.privacy;
    pub.discoverable = patch.privacy.appearInSearch !== false;
  }
  if (patch.mode !== undefined) priv.mode = patch.mode;

  if (patch.dob !== undefined) priv.dob = patch.dob;
  if (patch.education !== undefined) priv.education = patch.education;
  if (patch.firstName !== undefined) priv.firstName = cleanName(patch.firstName);
  if (patch.lastName !== undefined) priv.lastName = cleanName(patch.lastName);
  if (patch.email !== undefined) priv.email = patch.email;

  const batch = writeBatch(db);
  batch.set(profileRef(uid), pub, { merge: true });
  if (Object.keys(priv).length > 0) batch.set(privateRef(uid), priv, { merge: true });
  await batch.commit();
}

/** Change handle: reserve the new one, repoint the profile, then free the old one. */
export async function changeHandle(uid: string, rawHandle: string): Promise<string> {
  const previous = await getDoc(profileRef(uid));
  const previousHandle = previous.exists() ? asString(previous.data().handle) : "";

  const handleLower = await claimHandle(rawHandle, uid);
  const handle = rawHandle.trim().replace(/^@+/, "");

  await updateDoc(profileRef(uid), {
    handle,
    handleLower,
    updatedAt: serverTimestamp(),
  });

  if (previousHandle && normalizeHandle(previousHandle) !== handleLower) {
    await releaseHandle(previousHandle, uid).catch(() => {
      /* Leaving the old reservation behind is preferable to a broken rename. */
    });
  }

  return handle;
}

/**
 * Advance the daily login streak and persist it on the public profile, so
 * friends can see it. A streak counts local calendar days: opening the app on
 * the day after the last visit extends it, any skipped day restarts at 1, and
 * repeat launches on the same day are free (no write at all).
 */
export async function bumpStreak(uid: string): Promise<number> {
  const ref = profileRef(uid);
  const snap = await getDoc(ref);
  const d = (snap.data() ?? {}) as Record<string, unknown>;

  const now = new Date();
  const key = (t: Date) =>
    `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const today = key(now);
  if (asString(d.streakDay) === today) return asNumber(d.streak) ?? 1;

  const yesterday = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const next = asString(d.streakDay) === yesterday ? Math.max(1, asNumber(d.streak) ?? 1) + 1 : 1;

  await setDoc(ref, { streak: next, streakDay: today }, { merge: true });
  return next;
}

// -------------------------------------------------------------------- reads

export async function getPublicProfile(uid: string): Promise<PublicProfile | null> {
  const snap = await getDoc(profileRef(uid));
  if (!snap.exists()) return null;
  return toPublicProfile({ id: snap.id, data: () => snap.data() as Record<string, unknown> });
}

/** Public profiles for a set of uids, keyed by uid. Missing documents are omitted. */
export async function getPublicProfiles(uids: string[]): Promise<Map<string, PublicProfile>> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const found = new Map<string, PublicProfile>();
  if (unique.length === 0) return found;

  // documentId() is always indexed, so this needs no composite index and no
  // per-user round trip.
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));

  const results = await Promise.all(
    chunks.map((chunk) => getDocs(query(USERS, where(documentId(), "in", chunk)))),
  );
  for (const snap of results) for (const d of snap.docs) found.set(d.id, toPublicProfile(d));
  return found;
}

const SEARCH_MIN = 2;
const SEARCH_LIMIT = 15;

/**
 * Prefix search over handle and display name. Two independent range queries,
 * merged by uid — a prefix range is the only search Firestore supports.
 *
 * `discoverable == true` is filtered by the SERVER, so a hidden profile is never
 * returned to a search at all. The field is the public mirror of the owner-only
 * privacy.appearInSearch toggle and is kept in step by migratePrivacy() and
 * syncLocalProfile(). Both queries need a composite index
 * (discoverable + handleLower, discoverable + nameLower).
 */
export async function searchProfiles(rawQuery: string, myUid: string): Promise<PublicProfile[]> {
  const nameQuery = nameKey(rawQuery);
  const handleQuery = normalizeHandle(rawQuery);
  if (nameQuery.length < SEARCH_MIN && handleQuery.length < SEARCH_MIN) return [];

  const upper = "\uf8ff";
  const runs: Promise<{ docs: { id: string; data: () => Record<string, unknown> }[] }>[] = [];

  if (handleQuery.length >= SEARCH_MIN) {
    runs.push(
      getDocs(
        query(
          USERS,
          where("discoverable", "==", true),
          orderBy("handleLower"),
          where("handleLower", ">=", handleQuery),
          where("handleLower", "<=", handleQuery + upper),
          limit(SEARCH_LIMIT),
        ),
      ),
    );
  }
  if (nameQuery.length >= SEARCH_MIN) {
    runs.push(
      getDocs(
        query(
          USERS,
          where("discoverable", "==", true),
          orderBy("nameLower"),
          where("nameLower", ">=", nameQuery),
          where("nameLower", "<=", nameQuery + upper),
          limit(SEARCH_LIMIT),
        ),
      ),
    );
  }

  const settled = await Promise.all(runs);
  const byUid = new Map<string, PublicProfile>();
  for (const snap of settled) {
    for (const d of snap.docs) {
      if (d.id === myUid || byUid.has(d.id)) continue;
      byUid.set(d.id, toPublicProfile({ id: d.id, data: () => d.data() as Record<string, unknown> }));
      if (byUid.size >= SEARCH_LIMIT * 2) break;
    }
  }
  return Array.from(byUid.values());
}

/**
 * Push the parts of the local profile that live outside onboarding.
 * Split by destination: cosmetic/public fields go to users/{uid}, while the
 * privacy map and the sharing mode go to the owner-only users/{uid}/private/data.
 * The public doc only ever learns the derived `discoverable` boolean.
 *
 * Skips writes entirely when no fields have actually changed since the last sync,
 * preventing unnecessary Firestore churn from rapid profile edits or re-renders.
 */
export async function syncLocalProfile(
  uid: string,
  profile: Pick<
    Profile,
    "theme" | "accent" | "privacy" | "mode" | "socials" | "goalHours" | "color" | "avatarId"
  >,
): Promise<void> {
  const pub: Record<string, unknown> = {};
  const priv: Record<string, unknown> = {};

  if (profile.theme) pub.theme = profile.theme;
  if (profile.accent) pub.accent = profile.accent;
  if (profile.socials) pub.socials = profile.socials;
  if (typeof profile.goalHours === "number") pub.goalHours = profile.goalHours;
  if (profile.color) pub.color = profile.color;
  if (profile.avatarId) pub.avatarId = profile.avatarId;
  if (profile.privacy) {
    priv.privacy = profile.privacy;
    pub.discoverable = profile.privacy.appearInSearch !== false;
  }
  if (profile.mode) priv.mode = profile.mode;

  const pubKeys = Object.keys(pub);
  const privKeys = Object.keys(priv);
  if (pubKeys.length === 0 && privKeys.length === 0) return;

  // Read current values to avoid redundant writes when nothing changed.
  // This prevents unnecessary Firestore operations from rapid edits or re-renders.
  const [pubSnap, privSnap] = await Promise.all([
    getDoc(profileRef(uid)),
    getDoc(privateRef(uid)),
  ]);

  const pubData = pubSnap.exists() ? (pubSnap.data() ?? {}) : {};
  const privData = privSnap.exists() ? (privSnap.data() ?? {}) : {};

  // Filter out unchanged fields
  const changedPub: Record<string, unknown> = {};
  for (const key of pubKeys) {
    if (pub[key] !== pubData[key]) changedPub[key] = pub[key];
  }
  // Always include updatedAt if any public field changed
  if (Object.keys(changedPub).length > 0) changedPub.updatedAt = serverTimestamp();

  const changedPriv: Record<string, unknown> = {};
  for (const key of privKeys) {
    // Deep compare for privacy object
    if (JSON.stringify(priv[key]) !== JSON.stringify(privData[key])) {
      changedPriv[key] = priv[key];
    }
  }

  // Skip write entirely if nothing changed
  if (Object.keys(changedPub).length === 0 && Object.keys(changedPriv).length === 0) {
    return;
  }

  const batch = writeBatch(db);
  if (Object.keys(changedPub).length > 0) {
    batch.set(profileRef(uid), changedPub, { merge: true });
  }
  if (Object.keys(changedPriv).length > 0) batch.set(privateRef(uid), changedPriv, { merge: true });
  await batch.commit();
}

export { AVATAR_COLORS };
