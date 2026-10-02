// Temporary activity (reactions, comments, notifications) expires after 24 hours.
//
//   - The write carries `expiresAt` = now + 24h (rules bound it to ±1h of that).
//   - A Firestore TTL policy on each collection deletes the document afterwards.
//
// TTL deletion is best-effort and can lag, so every reader ALSO drops documents
// whose stamp is already in the past (isExpired). A missing or malformed stamp
// counts as non-expiring — a broken write can never hide a document forever.
import { Timestamp } from "firebase/firestore";

export const TTL_MS = 24 * 60 * 60 * 1000;

/** Client-side timestamp for `expiresAt` fields. */
export function expiresAt24h(): Timestamp {
  return Timestamp.fromMillis(Date.now() + TTL_MS);
}

/** True only when `v` is a valid timestamp that lies in the past. */
export function isExpired(v: unknown, nowMs: number = Date.now()): boolean {
  const t = v as { toMillis?: () => number } | null | undefined;
  if (!t || typeof t.toMillis !== "function") return false;
  const ms = t.toMillis();
  return typeof ms === "number" && Number.isFinite(ms) && ms <= nowMs;
}
