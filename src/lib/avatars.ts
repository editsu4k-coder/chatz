// The built-in avatar collection.
//
// Avatars are drawn, not stored: each id maps to a bundled SVG recipe, so a
// profile only ever carries `avatarId: "avatar_017"`. No image bytes go to
// Firestore, no Firebase Storage bucket exists, and nothing is downloaded.

export type AvatarGroup = "animals" | "gaming" | "space" | "quirky" | "nature" | "minimal";

export type AvatarArtKey =
  | "cat"
  | "bear"
  | "fox"
  | "bunny"
  | "panda"
  | "pup"
  | "owl"
  | "penguin"
  | "frog"
  | "robot"
  | "alien"
  | "astro"
  | "ghost"
  | "star"
  | "sprout"
  | "geometer";

/** Background gradient plus the three tones the character is drawn in. */
export type AvatarPalette = {
  from: string;
  to: string;
  face: string;
  ink: string;
  accent: string;
};

export const AVATAR_PALETTES: AvatarPalette[] = [
  { from: "#FFC46B", to: "#FF8A5B", face: "#FFF3E6", ink: "#4A2E23", accent: "#E8763F" },
  { from: "#8FE3D2", to: "#46B79F", face: "#F0FFF9", ink: "#17453C", accent: "#2F9A82" },
  { from: "#9CCBFF", to: "#5A8FEF", face: "#F2F8FF", ink: "#1D3A63", accent: "#4A7FDD" },
  { from: "#C3A8FF", to: "#8264E8", face: "#F7F3FF", ink: "#33265E", accent: "#7A5AE0" },
  { from: "#FFB3CD", to: "#F06C9D", face: "#FFF2F7", ink: "#5C1F38", accent: "#E75A8D" },
  { from: "#C6EC8F", to: "#7CC24A", face: "#F9FFEF", ink: "#2E4419", accent: "#6BB13A" },
  { from: "#FFD3A5", to: "#F5A05A", face: "#FFF8F1", ink: "#5A3520", accent: "#EF9542" },
  { from: "#93E6FF", to: "#37B5DD", face: "#EFFBFF", ink: "#123F52", accent: "#2AA3CA" },
  { from: "#B8A0FF", to: "#6E4FE0", face: "#F4F1FF", ink: "#2C1F5E", accent: "#6A4AD6" },
  { from: "#FFE894", to: "#F2C23C", face: "#FFFDF0", ink: "#4E3D0E", accent: "#E0AC24" },
  { from: "#FFAA96", to: "#F2665E", face: "#FFF4F1", ink: "#5C2620", accent: "#E8564E" },
  { from: "#7CDFC8", to: "#2E9E8C", face: "#EFFBF7", ink: "#12423A", accent: "#249583" },
];

export type AvatarSpec = {
  /** `avatar_001` … `avatar_048`. The only thing stored on a profile. */
  id: string;
  art: AvatarArtKey;
  palette: AvatarPalette;
  group: AvatarGroup;
  /** Human name for the shape, e.g. "Cat". */
  label: string;
  /** 1-based index within this shape, so the three colourways are tellable apart. */
  variant: number;
};

const ARCHETYPES: { art: AvatarArtKey; label: string; group: AvatarGroup }[] = [
  { art: "cat", label: "Cat", group: "animals" },
  { art: "bear", label: "Bear", group: "animals" },
  { art: "fox", label: "Fox", group: "animals" },
  { art: "bunny", label: "Bunny", group: "animals" },
  { art: "panda", label: "Panda", group: "animals" },
  { art: "pup", label: "Puppy", group: "animals" },
  { art: "owl", label: "Owl", group: "animals" },
  { art: "penguin", label: "Penguin", group: "animals" },
  { art: "frog", label: "Frog", group: "animals" },
  { art: "robot", label: "Robot", group: "gaming" },
  { art: "alien", label: "Alien", group: "space" },
  { art: "astro", label: "Astronaut", group: "space" },
  { art: "ghost", label: "Ghost", group: "quirky" },
  { art: "star", label: "Star", group: "quirky" },
  { art: "sprout", label: "Sprout", group: "nature" },
  { art: "geometer", label: "Minimal", group: "minimal" },
];

const VARIANTS = 3;

/**
 * 16 shapes × 3 colourways = 48 avatars. The palette offset (0, 3, 6) makes the
 * three variants of one shape differ, and the per-shape start (×5) stops every
 * shape from opening on the same colour.
 */
export const AVATARS: AvatarSpec[] = ARCHETYPES.flatMap((meta, shapeIndex) =>
  Array.from({ length: VARIANTS }, (_, variant) => {
    const index = shapeIndex * VARIANTS + variant;
    return {
      id: `avatar_${String(index + 1).padStart(3, "0")}`,
      art: meta.art,
      palette: AVATAR_PALETTES[(shapeIndex * 5 + variant * 3) % AVATAR_PALETTES.length],
      group: meta.group,
      label: meta.label,
      variant: variant + 1,
    };
  }),
);

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

export const AVATAR_GROUPS: { key: AvatarGroup; label: string }[] = [
  { key: "animals", label: "Animals" },
  { key: "gaming", label: "Gaming" },
  { key: "space", label: "Space & fantasy" },
  { key: "quirky", label: "Fun & quirky" },
  { key: "nature", label: "Nature" },
  { key: "minimal", label: "Minimal" },
];

export const DEFAULT_AVATAR_ID = AVATARS[0].id;

export function avatarSpec(id: string | undefined | null): AvatarSpec | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function isAvatarId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** A stable pick for someone who never opens the picker. */
export function randomAvatarId(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].id;
}

/** Accessible name for a single avatar, e.g. "Cat avatar 2". */
export function avatarLabel(spec: AvatarSpec): string {
  return `${spec.label} avatar ${spec.variant}`;
}
