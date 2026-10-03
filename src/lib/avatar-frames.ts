// Reward avatar frames: 10 drawn rings layered around the avatar. The three
// common ones are the starter drop (one random frame when a profile completes);
// the rest unlock through real, durable achievements — streak days and friend
// count — so rarity tracks how hard the goal actually is.
export type FrameRarity = "common" | "rare" | "epic" | "legendary";

export type FrameGoal =
  | { kind: "starter" }
  | { kind: "streak"; days: number }
  | { kind: "friends"; count: number };

export type AvatarFrameDef = {
  id: string;
  name: string;
  rarity: FrameRarity;
  goal: FrameGoal;
  /** CSS background painted as the ring around the avatar. */
  background: string;
  /** Optional glow; epic/legendary frames carry one. */
  glow?: string;
  /** Animated sheen for the higher tiers. */
  animated?: boolean;
};

export const AVATAR_FRAMES: AvatarFrameDef[] = [
  { id: "frame_comet",  name: "Comet",  rarity: "common",    goal: { kind: "starter" },
    background: "linear-gradient(135deg,#38BDF8 0%,#6366F1 100%)" },
  { id: "frame_sunset", name: "Sunset", rarity: "common",    goal: { kind: "starter" },
    background: "linear-gradient(135deg,#FB923C 0%,#EC4899 100%)" },
  { id: "frame_bubble", name: "Bubble", rarity: "common",    goal: { kind: "starter" },
    background: "linear-gradient(135deg,#A78BFA 0%,#F472B6 100%)" },
  { id: "frame_spark",  name: "Spark",  rarity: "rare",      goal: { kind: "streak", days: 3 },
    background: "linear-gradient(135deg,#FBBF24 0%,#F97316 100%)",
    glow: "0 0 10px rgba(251,191,36,0.45)" },
  { id: "frame_circle", name: "Circle", rarity: "rare",      goal: { kind: "friends", count: 1 },
    background: "linear-gradient(135deg,#34D399 0%,#0EA5E9 100%)",
    glow: "0 0 10px rgba(52,211,153,0.45)" },
  { id: "frame_pulse",  name: "Pulse",  rarity: "epic",      goal: { kind: "streak", days: 7 },
    background: "linear-gradient(120deg,#60A5FA 0%,#A855F7 50%,#EC4899 100%)",
    glow: "0 0 14px rgba(168,85,247,0.5)", animated: true },
  { id: "frame_orbit",  name: "Orbit",  rarity: "epic",      goal: { kind: "friends", count: 5 },
    background: "linear-gradient(120deg,#22D3EE 0%,#6366F1 50%,#C026D3 100%)",
    glow: "0 0 14px rgba(34,211,238,0.5)", animated: true },
  { id: "frame_nova",   name: "Nova",   rarity: "legendary", goal: { kind: "streak", days: 14 },
    background: "linear-gradient(120deg,#FDE68A 0%,#F59E0B 45%,#EF4444 100%)",
    glow: "0 0 18px rgba(245,158,11,0.6)", animated: true },
  { id: "frame_crown",  name: "Crown",  rarity: "legendary", goal: { kind: "friends", count: 10 },
    background: "linear-gradient(120deg,#F59E0B 0%,#F43F5E 50%,#8B5CF6 100%)",
    glow: "0 0 18px rgba(244,63,94,0.55)", animated: true },
  { id: "frame_prism",  name: "Prism",  rarity: "legendary", goal: { kind: "streak", days: 30 },
    background: "linear-gradient(120deg,#F43F5E 0%,#F59E0B 20%,#22C55E 40%,#06B6D4 60%,#6366F1 80%,#D946EF 100%)",
    glow: "0 0 20px rgba(255,255,255,0.4)", animated: true },
];

export const RARITY_LABEL: Record<FrameRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export const RARITY_STYLE: Record<FrameRarity, string> = {
  common: "bg-secondary text-muted-foreground",
  rare: "bg-emerald-500/15 text-emerald-500",
  epic: "bg-violet-500/15 text-violet-400",
  legendary: "bg-amber-500/15 text-amber-500",
};

export function avatarFrame(id?: string): AvatarFrameDef | null {
  if (!id) return null;
  return AVATAR_FRAMES.find((f) => f.id === id) ?? null;
}

export function isFrameId(id?: string): boolean {
  return avatarFrame(id) !== null;
}

/** One of the three common frames, picked at random for the starter claim. */
export function randomStarterFrame(): string {
  const starters = AVATAR_FRAMES.filter((f) => f.goal.kind === "starter");
  return starters[Math.floor(Math.random() * starters.length)].id;
}

export function frameGoalLabel(f: AvatarFrameDef): string {
  switch (f.goal.kind) {
    case "starter":
      return "Free with your completed profile";
    case "streak":
      return `Reach a ${f.goal.days}-day streak`;
    case "friends":
      return f.goal.count === 1
        ? "Add your first friend"
        : `Add ${f.goal.count} friends`;
  }
}
