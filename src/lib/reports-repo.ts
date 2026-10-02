// User reports, stored on Firestore.
//
//   reports/{autoId}   { reporterUid, reportedUid, reason, details, createdAt }
//
// Write-only from the app: the security rules allow exactly one create with
// reporterUid == request.auth.uid, and NO read/update/delete for anyone — the
// reported person can never see, edit or delete a report about themselves.
// Review happens in the Firebase console. The reporter's identity is stored for
// moderation but is never exposed to the reported user, and the report is
// deliberately separate from blocking: reporting does not block or unfriend.
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type ReportReason =
  | "spam"
  | "harassment"
  | "impersonation"
  | "inappropriate"
  | "other";

export const REPORT_REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "impersonation", label: "Impersonation" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];

const MAX_DETAILS = 1000;

/** Submit a report. Never throws for expected input; returns false instead. */
export async function reportUser(
  reporterUid: string,
  reportedUid: string,
  reason: ReportReason,
  details: string,
): Promise<boolean> {
  if (!reporterUid || !reportedUid || reporterUid === reportedUid) return false;
  if (!REPORT_REASONS.some((r) => r.value === reason)) return false;
  const text = details.trim().slice(0, MAX_DETAILS);
  try {
    await addDoc(collection(db, "reports"), {
      reporterUid,
      reportedUid,
      reason,
      details: text,
      createdAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.warn("reports: submit failed", err);
    return false;
  }
}
