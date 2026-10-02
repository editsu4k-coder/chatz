// Android 13+ "restricted setting" block: Usage access is denied or greyed out
// for apps installed outside Google Play until the user allows restricted
// settings in ChatZ's App info. Nothing can detect or flip that flag from
// code, so this dialog only walks the user through the legitimate Settings
// screens — and it appears only after a real attempt came back denied, with
// every state change confirmed by re-reading the actual permission.
import { ExternalLink, Loader2, ShieldAlert } from "lucide-react";

export type RestrictedStage = "guide" | "afterAppInfo";

const STEPS = [
  "Open ChatZ App Info.",
  "Tap the ⋮ menu at the top right.",
  "Select “Allow restricted settings”.",
  "Return to ChatZ.",
  "Enable Screen Time access.",
];

export function RestrictedUsageDialog({
  stage,
  busy,
  stillDenied,
  onOpenAppInfo,
  onOpenUsageSettings,
  onTryAgain,
  onDismiss,
}: {
  stage: RestrictedStage;
  busy: "appInfo" | "usage" | "try" | null;
  stillDenied: boolean;
  onOpenAppInfo: () => void;
  onOpenUsageSettings: () => void;
  onTryAgain: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center px-4 pb-6">
      <div className="w-full max-w-md rounded-3xl bg-surface border border-border p-5 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-500 grid place-items-center shrink-0">
            <ShieldAlert size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-tight">
              Screen Time access is restricted
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
              {stage === "afterAppInfo"
                ? "Your device is currently preventing ChatZ from receiving Screen Time access. You may need to allow restricted settings for ChatZ in App Info."
                : "Some Android devices restrict this permission for apps installed outside Google Play. To enable Screen Time tracking, Android may require you to allow restricted settings for ChatZ first."}
            </p>
          </div>
        </div>

        <ol className="mt-4 list-decimal pl-5 space-y-1.5 text-[13px] text-muted-foreground leading-relaxed marker:text-foreground">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        {stillDenied && (
          <p className="mt-3 text-[13px] font-medium text-amber-500">
            Screen Time access is still off — follow the steps above, then try again.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {stage === "guide" ? (
            <button
              onClick={onOpenAppInfo}
              className="h-12 rounded-full bg-primary text-primary-foreground font-medium text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              {busy === "appInfo" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ExternalLink size={16} />
              )}
              Open ChatZ App Info
            </button>
          ) : (
            <button
              onClick={onOpenUsageSettings}
              className="h-12 rounded-full bg-primary text-primary-foreground font-medium text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              {busy === "usage" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ExternalLink size={16} />
              )}
              Open Screen Time Settings
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onTryAgain}
              className="flex-1 h-11 rounded-full bg-secondary text-foreground font-medium text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              {busy === "try" ? <Loader2 size={16} className="animate-spin" /> : null}
              Try Again
            </button>
            {stage === "afterAppInfo" && (
              <button
                onClick={onOpenAppInfo}
                className="flex-1 h-11 rounded-full border border-border text-foreground font-medium text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                {busy === "appInfo" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ExternalLink size={15} />
                )}
                Open App Info
              </button>
            )}
          </div>
          <button
            onClick={onDismiss}
            className="mt-1 text-[13px] font-medium text-muted-foreground underline self-center"
          >
            Not now
          </button>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
          Only Android's own screens can change this setting — ChatZ can't do it for you, and
          Screen Time stays locked until access is actually granted.
        </p>
      </div>
    </div>
  );
}
