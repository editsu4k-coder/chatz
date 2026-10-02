// Handle normalisation. One canonical form so "@JohnDoe", "@johndoe" and
// "@JOHNDOE" can never become three different accounts.
//
// The normalised value is the document ID in `handles/{normalizedHandle}` and is
// also stored as `handleLower` on `users/{uid}`, which is what search ranges over.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

/**
 * Lowercase and drop everything that is not a-z, 0-9 or underscore. Typing
 * "John.Doe" silently becomes "johndoe" rather than being rejected.
 */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

export function handleProblem(raw: string): string | null {
  const h = normalizeHandle(raw);
  if (h.length === 0) return "Pick a handle.";
  if (h.length < HANDLE_MIN) return `Handles need at least ${HANDLE_MIN} characters.`;
  if (h.length > HANDLE_MAX) return `Handles can be at most ${HANDLE_MAX} characters.`;
  return null;
}
