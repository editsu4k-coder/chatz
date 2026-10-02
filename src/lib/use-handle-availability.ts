import { useEffect, useState } from "react";
import { handleProblem, normalizeHandle } from "./handle";
import { isHandleAvailable } from "./profile-repo";

export type HandleCheckState = "idle" | "checking" | "available" | "taken" | "error";

/**
 * Debounced handle availability probe against the `handles/{handle}` reservation.
 * Purely advisory UI: `claimHandle`/`changeHandle` still decide at save time, so
 * a stale "available" can never hand out a taken handle.
 *
 * Reports idle for empty/invalid input and for the caller's current handle.
 */
export function useHandleAvailability(
  handle: string,
  uid: string | undefined,
  currentHandle?: string,
): HandleCheckState {
  const [state, setState] = useState<HandleCheckState>("idle");

  useEffect(() => {
    const normalized = normalizeHandle(handle);
    if (
      !uid ||
      !normalized ||
      handleProblem(handle) ||
      normalized === normalizeHandle(currentHandle ?? "")
    ) {
      setState("idle");
      return;
    }

    setState("checking");
    let cancelled = false;
    const timer = setTimeout(() => {
      isHandleAvailable(normalized, uid)
        .then((free) => {
          if (!cancelled) setState(free ? "available" : "taken");
        })
        .catch(() => {
          if (!cancelled) setState("error");
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handle, uid, currentHandle]);

  return state;
}
