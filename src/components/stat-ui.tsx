// Shared building blocks for the screen-time pages (own stats + friend stats).
// Extracted from duplicated local copies so both pages stay visually identical.
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 text-[18px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function AppIcon({ name }: { name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <span className="w-9 h-9 rounded-[10px] bg-secondary grid place-items-center text-[14px] font-semibold text-muted-foreground shrink-0">
      {initial}
    </span>
  );
}

export function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatMs(ms: number): string {
  return formatMinutes(Math.round(ms / 60000));
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

export function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Shutter/accordion card. The header row (title, optional `right` summary,
 * chevron) always stays visible; the body animates open/closed. Used for the
 * device-stats block and the most-used-apps list so a long page can be folded
 * down to its essentials.
 */
export function CollapsibleCard({
  title,
  icon,
  right,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: ReactNode;
  right?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-3xl bg-surface border border-border/60 overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group w-full flex items-center gap-2 px-4 py-3.5 text-left active:bg-secondary/60 transition"
          >
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </span>
            <span className="ml-auto flex items-center gap-2">
              {right}
              <ChevronDown
                size={16}
                className="text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180"
              />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="collapsible-content">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
