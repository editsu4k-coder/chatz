// Full-screen prompt shown inside the app shell when any of the three core
// Android permissions is missing (revoked later, or never granted). The user
// can grant here, or explicitly continue with limited access — ChatZ then
// shows honest "no access" states instead of fake data.
import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, ShieldAlert } from "lucide-react";
import { ChatZMark } from "./Logo";
import { RestrictedSettingsNote } from "./RestrictedSettingsNote";
import {
  RestrictedUsageDialog,
  type RestrictedStage,
} from "./RestrictedUsageDialog";
import {
  REQUIRED_PERMS,
  checkPerm,
  openPermSettings,
  type PermKey,
  type PermState,
} from "@/lib/app-permissions";
import { VibeStats } from "@/lib/vibe-stats";

export function PermissionGate({
  state,
  recheck,
  onSignOut,
  onSkip,
}: {
  state: PermState;
  recheck: () => void;
  onSignOut?: () => void;
  onSkip?: () => void;
}) {
  const [busy, setBusy] = useState<PermKey | null>(null);
  const [checking, setChecking] = useState(false);

  // Restricted-settings state machine. Every Android-settings round trip ends
  // in a fresh `state` prop (recheck here + app.tsx's appStateChange refresh),
  // so a pending attempt that comes back denied decides the next phase — the
  // permission itself is never assumed. Only user taps open Settings, so a
  // back-out can never loop.
  const pendingStageRef = useRef<RestrictedStage | null>(null);
  const [stage, setStage] = useState<RestrictedStage | null>(null);
  const [dlgBusy, setDlgBusy] = useState<"appInfo" | "usage" | "try" | null>(null);
  const [stillDenied, setStillDenied] = useState(false);

  useEffect(() => {
    if (state.usage) {
      pendingStageRef.current = null;
      setStage(null);
      setStillDenied(false);
      return;
    }
    if (!pendingStageRef.current) return;
    const next = pendingStageRef.current;
    pendingStageRef.current = null;
    setStage(next);
  }, [state]);

  const open = async (id: PermKey) => {
    setBusy(id);
    if (id === "usage") pendingStageRef.current = "guide";
    try {
      await openPermSettings(id);
      // A granted runtime dialog (notifications) resolves without the app ever
      // leaving the foreground, so appStateChange never fires — re-check now
      // instead of waiting for the user to tap "Check again".
      recheck();
    } catch {
      /* the settings screen may refuse to open on some OEMs; the user can grant manually */
      pendingStageRef.current = null;
    }
    setBusy(null);
  };

  const openAppInfo = async () => {
    setDlgBusy("appInfo");
    pendingStageRef.current = "afterAppInfo";
    try {
      // Native side builds package:com.chatz.app dynamically — never hardcoded.
      await VibeStats.openAppSettings();
      recheck();
    } catch {
      pendingStageRef.current = null;
    }
    setDlgBusy(null);
  };

  const openUsageFromDialog = async () => {
    setDlgBusy("usage");
    // Coming back denied stays on this phase — never bounce the user back to
    // the first-screen guidance in a loop.
    pendingStageRef.current = "afterAppInfo";
    try {
      await VibeStats.requestUsageAccess();
      recheck();
    } catch {
      pendingStageRef.current = null;
    }
    setDlgBusy(null);
  };

  const tryAgain = async () => {
    setDlgBusy("try");
    const granted = await checkPerm("usage");
    recheck();
    setStillDenied(!granted);
    setDlgBusy(null);
  };

  const checkAgain = () => {
    setChecking(true);
    recheck();
    setTimeout(() => setChecking(false), 900);
  };

  const missing = REQUIRED_PERMS.filter((p) => !state[p.id]).length;

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 pt-12 pb-8">
      <div className="flex items-center gap-2.5">
        <span className="rounded-[10px] overflow-hidden bg-foreground text-background flex">
          <ChatZMark size={30} glyphOnly bg="transparent" fg="currentColor" />
        </span>
        <span className="text-[17px] font-semibold tracking-tight">
          Chat<span className="font-bold">Z</span>
        </span>
      </div>

      <h1 className="mt-6 text-[26px] font-semibold tracking-tight">
        {missing === 1 ? "One permission left" : `${missing} permissions needed`}
      </h1>
      <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">
        ChatZ needs these Android permissions to work. Grant each one below — the app unlocks
        automatically as soon as all three are on.
      </p>

      <ul className="mt-6 space-y-2.5">
        {REQUIRED_PERMS.map((p) => {
          const done = state[p.id];
          const isBusy = busy === p.id;
          return (
            <li key={p.id}>
              <button
                onClick={() => !done && open(p.id)}
                disabled={done}
                className={`w-full rounded-2xl border p-3.5 flex items-center gap-3 text-left transition-all ${
                  done
                    ? "border-success/40 bg-success/5"
                    : "border-border bg-surface active:scale-[0.99]"
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${
                    done ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check size={18} />
                  ) : isBusy ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ShieldAlert size={18} />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium">{p.label}</span>
                  <span className="block text-[12px] text-muted-foreground">
                    {done ? "Granted" : isBusy ? "Opening settings…" : p.howTo}
                  </span>
                </span>
                {!done && <ExternalLink size={16} className="text-primary shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        onClick={checkAgain}
        className="mt-6 h-12 rounded-full bg-primary text-primary-foreground font-medium text-[15px] grid place-items-center active:scale-[0.98] transition"
      >
        {checking ? <Loader2 size={18} className="animate-spin" /> : "Check again"}
      </button>
      <p className="mt-3 text-[12px] text-muted-foreground text-center leading-relaxed">
        After changing a setting, come back here — the status updates automatically.
      </p>

      {!state.usage && !stage && <RestrictedSettingsNote className="mt-4" />}

      {onSkip && (
        <div className="mt-auto pt-8 flex flex-col items-center gap-2">
          <button onClick={onSkip} className="text-[13px] font-medium text-foreground underline">
            Continue with limited access
          </button>
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed max-w-xs">
            Features that need a missing permission stay off and show honest "no access" states —
            ChatZ never invents data. Grant them any time in Settings → Permissions.
          </p>
        </div>
      )}
      {onSignOut && (
        <button
          onClick={onSignOut}
          className={`${onSkip ? "mt-4" : "mt-auto pt-8"} text-[12px] text-muted-foreground underline self-center`}
        >
          Sign out instead
        </button>
      )}

      {stage && !state.usage && (
        <RestrictedUsageDialog
          stage={stage}
          busy={dlgBusy}
          stillDenied={stillDenied}
          onOpenAppInfo={openAppInfo}
          onOpenUsageSettings={openUsageFromDialog}
          onTryAgain={tryAgain}
          onDismiss={() => setStage(null)}
        />
      )}
    </div>
  );
}
