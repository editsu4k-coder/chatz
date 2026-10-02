// Android 13+ blocks sensitive permissions (Usage access and similar) for apps
// installed outside a recognized store: the toggle is greyed out with a
// "Restricted setting" message until the user allows restricted settings in
// App info — one unlock per device. No API can do this from code, so the app
// can only walk the user through it.
import { ExternalLink, ShieldAlert } from "lucide-react";
import { VibeStats } from "@/lib/vibe-stats";

export function RestrictedSettingsNote({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <ShieldAlert size={20} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="text-[13px] leading-relaxed min-w-0">
          <div className="font-semibold text-foreground">
            Screen-time access blocked or greyed out?
          </div>
          <p className="mt-1 text-muted-foreground">
            Android 13+ blocks sensitive permissions — like Usage access — for apps installed
            outside the Play Store. The toggle shows a "Restricted setting" warning. Unlock it
            once per device:
          </p>
          <ol className="mt-2 list-decimal pl-4 space-y-1 text-muted-foreground">
            <li>Open ChatZ's App info.</li>
            <li>
              Tap the <span className="font-medium text-foreground">⋮ menu</span> at the
              top-right — it may be called{" "}
              <span className="font-medium text-foreground">"More"</span> on some phones
              (Oppo/ColorOS, realme).
            </li>
            <li>
              Choose{" "}
              <span className="font-medium text-foreground">"Allow restricted settings"</span>{" "}
              and confirm with your PIN, pattern or fingerprint.
            </li>
            <li>Come back and toggle Usage access ON — ChatZ re-checks automatically.</li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => VibeStats.openAppSettings().catch(() => {})}
              className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium inline-flex items-center gap-2 active:scale-95"
            >
              <ExternalLink size={14} /> Open App info
            </button>
            <button
              onClick={() => VibeStats.requestUsageAccess().catch(() => {})}
              className="h-9 px-4 rounded-full bg-secondary text-foreground text-[13px] font-medium inline-flex items-center gap-2 active:scale-95"
            >
              <ExternalLink size={14} /> Open Usage access
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
