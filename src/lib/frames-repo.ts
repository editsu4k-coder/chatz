// Avatar-frame claims and equipping. Everything here is owner-writable under
// the existing users/{uid} rules (no whitelist), so no rules change is needed —
// but a goal claim still re-reads the real counters from the server first, so
// the app never hands out a frame the user has not actually earned.
import { doc, getDocFromServer, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { fetchFriendCount } from "./friends-repo";
import { readProfile, writeProfile } from "./profile-store";
import { avatarFrame, randomStarterFrame, type AvatarFrameDef } from "./avatar-frames";

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
}

/**
 * Give the user their one random starter frame. Safe to call on every launch:
 * it reads the server document first and no-ops once any frame is owned, so
 * both fresh signups and users upgrading from a pre-frames build claim exactly
 * once, without any action from them.
 */
export async function claimStarterFrame(uid: string): Promise<string | null> {
  if (!uid) return null;
  const snap = await getDocFromServer(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const owned = asStringArray((snap.data() as Record<string, unknown>).frames);
  if (owned.length > 0) return null;
  const frame = randomStarterFrame();
  await setDoc(doc(db, "users", uid), { frames: [frame], frame }, { merge: true });
  const p = readProfile();
  if (p && p.uid === uid) writeProfile({ ...p, frames: [frame], frame });
  return frame;
}

/**
 * Claim a goal frame after verifying the real counters server-side.
 * Returns false (and changes nothing) when the goal is not met yet.
 */
export async function claimGoalFrame(uid: string, def: AvatarFrameDef): Promise<boolean> {
  if (!uid || def.goal.kind === "starter") return false;
  const [snap, friends] = await Promise.all([
    getDocFromServer(doc(db, "users", uid)),
    fetchFriendCount(uid),
  ]);
  if (!snap.exists()) return false;
  const d = snap.data() as Record<string, unknown>;
  const owned = asStringArray(d.frames);
  if (owned.includes(def.id)) return true;
  if (def.goal.kind === "streak") {
    const streak = typeof d.streak === "number" ? d.streak : 0;
    if (streak < def.goal.days) return false;
  } else {
    if ((friends ?? 0) < def.goal.count) return false;
  }
  const frames = [...owned, def.id];
  await setDoc(doc(db, "users", uid), { frames }, { merge: true });
  const p = readProfile();
  if (p && p.uid === uid) writeProfile({ ...p, frames });
  return true;
}

/** Equip an owned frame: local cache first (instant UI), shell mirrors it out. */
export function equipFrame(uid: string, frameId: string): boolean {
  if (!avatarFrame(frameId)) return false;
  const p = readProfile();
  if (!p || p.uid !== uid) return false;
  if (!(p.frames ?? []).includes(frameId)) return false;
  writeProfile({ ...p, frame: frameId });
  return true;
}
