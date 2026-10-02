// DEBUG-ONLY Firebase operation counter for stress testing.
// Tracks reads, writes, listener registrations/removals to measure backend usage.
// MUST be disabled in production builds — use only during development/testing.

const DEBUG_ENABLED = typeof window !== "undefined" && (window as any).__CHATZ_DEBUG_FIREBASE_OPS === true;

interface OpCounts {
  reads: number;
  writes: number;
  listenerRegistrations: number;
  listenerRemovals: number;
  batchCommits: number;
  transactions: number;
}

let counts: OpCounts = {
  reads: 0,
  writes: 0,
  listenerRegistrations: 0,
  listenerRemovals: 0,
  batchCommits: 0,
  transactions: 0,
};

const RESET_INTERVAL_MS = 60_000; // Auto-reset every 60s to keep numbers fresh
let resetTimer: number | undefined;

function resetCounts() {
  counts = {
    reads: 0,
    writes: 0,
    listenerRegistrations: 0,
    listenerRemovals: 0,
    batchCommits: 0,
    transactions: 0,
  };
  console.log("[DEBUG] Firebase ops counter reset");
}

function scheduleReset() {
  if (!DEBUG_ENABLED) return;
  if (resetTimer) window.clearInterval(resetTimer);
  resetTimer = window.setInterval(resetCounts, RESET_INTERVAL_MS);
}

export function incrementRead(op?: string) {
  if (!DEBUG_ENABLED) return;
  counts.reads++;
  if (op) console.log(`[DEBUG] Firestore read: ${op} (total: ${counts.reads})`);
}

export function incrementWrite(op?: string) {
  if (!DEBUG_ENABLED) return;
  counts.writes++;
  if (op) console.log(`[DEBUG] Firestore write: ${op} (total: ${counts.writes})`);
}

export function incrementListenerRegistration(collection?: string) {
  if (!DEBUG_ENABLED) return;
  counts.listenerRegistrations++;
  if (collection) console.log(`[DEBUG] Listener registered: ${collection} (total: ${counts.listenerRegistrations})`);
}

export function incrementListenerRemoval(collection?: string) {
  if (!DEBUG_ENABLED) return;
  counts.listenerRemovals++;
  if (collection) console.log(`[DEBUG] Listener removed: ${collection} (total: ${counts.listenerRemovals})`);
}

export function incrementBatchCommit(op?: string) {
  if (!DEBUG_ENABLED) return;
  counts.batchCommits++;
  if (op) console.log(`[DEBUG] Batch commit: ${op} (total: ${counts.batchCommits})`);
}

export function incrementTransaction(op?: string) {
  if (!DEBUG_ENABLED) return;
  counts.transactions++;
  if (op) console.log(`[DEBUG] Transaction: ${op} (total: ${counts.transactions})`);
}

export function getDebugCounts(): OpCounts & { activeListeners: number } {
  return {
    ...counts,
    activeListeners: counts.listenerRegistrations - counts.listenerRemovals,
  };
}

export function printDebugReport() {
  if (!DEBUG_ENABLED) {
    console.log("[DEBUG] Firebase ops counter is disabled. Enable with: window.__CHATZ_DEBUG_FIREBASE_OPS = true");
    return;
  }
  const active = getDebugCounts();
  console.group("[DEBUG] Firebase Operations Report");
  console.log("Reads:", counts.reads);
  console.log("Writes:", counts.writes);
  console.log("Batch commits:", counts.batchCommits);
  console.log("Transactions:", counts.transactions);
  console.log("Listener registrations:", counts.listenerRegistrations);
  console.log("Listener removals:", counts.listenerRemovals);
  console.log("Active listeners:", active.activeListeners);
  console.groupEnd();
}

// Start auto-reset timer if enabled
if (DEBUG_ENABLED) {
  scheduleReset();
  console.log("[DEBUG] Firebase ops counter enabled — call printDebugReport() to see current counts");
}
