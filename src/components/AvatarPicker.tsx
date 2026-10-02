import { Check } from "lucide-react";
import { AVATARS, AVATAR_GROUPS, avatarLabel, type AvatarSpec } from "@/lib/avatars";
import { AvatarArt } from "@/components/Avatar";

/**
 * The built-in avatar grid. Purely a picker: it reports the chosen id and the
 * caller decides when to persist it.
 */
export function AvatarPicker({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {AVATAR_GROUPS.map((group) => {
        const items = AVATARS.filter((a) => a.group === group.key);
        if (items.length === 0) return null;
        return (
          <div key={group.key}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
              {group.label}
            </div>
            <div className="grid grid-cols-6 gap-2">
              {items.map((spec) => (
                <AvatarTile
                  key={spec.id}
                  spec={spec}
                  selected={value === spec.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AvatarTile({
  spec,
  selected,
  onSelect,
}: {
  spec: AvatarSpec;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(spec.id)}
      aria-label={avatarLabel(spec)}
      aria-pressed={selected}
      className={`relative aspect-square rounded-2xl overflow-hidden transition-all duration-200 ease-out active:scale-95 ${
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "ring-1 ring-border/60 opacity-90 hover:opacity-100"
      }`}
    >
      <AvatarArt id={spec.id} className="w-full h-full block" />
      {selected && (
        <span className="absolute right-1 top-1 w-4 h-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
          <Check size={10} strokeWidth={3.5} />
        </span>
      )}
    </button>
  );
}
