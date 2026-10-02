# DEBUG Firebase Operations Counter

## Purpose

Track Firestore reads, writes, listener registrations/removals, batch commits, and transactions during stress testing to measure backend usage and identify optimization opportunities.

**MUST BE DISABLED IN PRODUCTION.** This is a development-only tool.

## How to Enable

In the browser console (during development), run:

```javascript
window.__CHATZ_DEBUG_FIREBASE_OPS = true;
location.reload();
```

Or add this to your `index.html` temporarily:

```html
<script>window.__CHATZ_DEBUG_FIREBASE_OPS = true;</script>
```

## Usage

Once enabled, the counter will automatically log operations to the console. To see a summary report at any time:

```javascript
printDebugReport();
```

This prints:
- Total reads
- Total writes
- Batch commits
- Transactions
- Listener registrations
- Listener removals
- **Active listeners** (registrations - removals) — this should trend toward 0 when navigating away from screens

The counter auto-resets every 60 seconds to keep numbers fresh during long testing sessions.

## Currently Instrumented

- `usage-repo.ts`: subscribeUsageStats, pushUsageSnapshot, setPresence
- More repositories can be instrumented by importing from `debug-firebase-counter.ts` and calling the increment functions

## Adding Instrumentation to New Code

```typescript
import { incrementRead, incrementWrite, incrementListenerRegistration, incrementListenerRemoval } from "./debug-firebase-counter";

// For reads
incrementRead("operationName");

// For writes
incrementWrite("operationName");

// For listener registration
incrementListenerRegistration("collectionName");

// For listener removal (wrap the unsubscribe function)
const unsub = onSnapshot(...);
return () => {
  incrementListenerRemoval("collectionName");
  unsub();
};
```

## Example Stress Test Workflow

1. Enable debug mode
2. Open Home screen → note active listeners
3. Navigate to Friends → note new listeners
4. Open a friend's stats card → note listener count
5. Navigate back → verify listeners decreased
6. Run `printDebugReport()` to see totals
7. Compare before/after counts to verify optimizations are working

## Disabling

Remove the flag or set it to false:

```javascript
window.__CHATZ_DEBUG_FIREBASE_OPS = false;
```

Then rebuild for production. The counter code is tree-shaken out of production builds when the flag is not set.
