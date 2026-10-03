import type { CSSProperties } from "react";
import type { ReactNode } from "react";
import { getInitials } from "@/lib/profile-store";
import { avatarSpec, type AvatarArtKey, type AvatarPalette } from "@/lib/avatars";
import { avatarFrame } from "@/lib/avatar-frames";

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
const SIZES: Record<Size, { box: string; text: string; dot: string }> = {
  xs:   { box: "w-7 h-7",  text: "text-[10px]", dot: "w-2 h-2" },
  sm:   { box: "w-9 h-9",  text: "text-[12px]", dot: "w-2.5 h-2.5" },
  md:   { box: "w-11 h-11", text: "text-[14px]", dot: "w-3 h-3" },
  lg:   { box: "w-12 h-12", text: "text-[15px]", dot: "w-3 h-3" },
  xl:   { box: "w-16 h-16", text: "text-[20px]", dot: "w-3.5 h-3.5" },
  "2xl":{ box: "w-24 h-24", text: "text-[30px]", dot: "w-5 h-5" },
  "3xl":{ box: "w-28 h-28", text: "text-[34px]", dot: "w-5 h-5" },
};

export function Avatar({
  name,
  color,
  avatarId,
  frame,
  size = "md",
  className = "",
  square = false,
  online,
}: {
  name: string;
  color: string;
  /** Bundled avatar id (`avatar_017`). Falls back to initials when absent. */
  avatarId?: string;
  /** Reward frame id (`frame_nova`). Replaces the colour ring when owned. */
  frame?: string;
  size?: Size;
  className?: string;
  square?: boolean;
  online?: boolean;
}) {
  const spec = avatarSpec(avatarId);
  const s = SIZES[size];
  const shape = square ? "rounded-2xl" : "rounded-full";

  // The personal colour is the avatar's frame: it rings every art avatar and
  // paints the background of initials avatars, so the choice stays visible
  // everywhere the avatar is. A reward frame overrides that ring.
  const colorPaint = {
    background: `linear-gradient(135deg, ${color} 0%, ${shade(color, -15)} 100%)`,
  };
  const frameDef = avatarFrame(frame);
  const ringPaint: CSSProperties = frameDef
    ? {
        background: frameDef.background,
        boxShadow: frameDef.glow,
        backgroundSize: frameDef.animated ? "220% 220%" : undefined,
      }
    : colorPaint;
  const ringClass = frameDef?.animated ? "frame-shine" : "";

  const inner = spec ? (
    <div className={`${s.box} ${shape} p-[2px] flex-shrink-0 ${ringClass}`} style={ringPaint}>
      <div className={`w-full h-full ${shape} overflow-hidden`}>
        <AvatarArt id={spec.id} className="w-full h-full block" />
      </div>
    </div>
  ) : frameDef ? (
    <div className={`${s.box} ${shape} p-[2.5px] flex-shrink-0 ${ringClass}`} style={ringPaint}>
      <div
        className={`w-full h-full ${shape} grid place-items-center font-semibold text-white ${s.text}`}
        style={colorPaint}
      >
        {getInitials(name)}
      </div>
    </div>
  ) : (
    <div
      className={`${s.box} ${shape} grid place-items-center font-semibold text-white flex-shrink-0 ${s.text}`}
      style={colorPaint}
    >
      {getInitials(name)}
    </div>
  );

  if (online === undefined) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      {inner}
      <span
        className={`absolute -bottom-0 -right-0 ${s.dot} rounded-full ring-2 ring-background ${online ? "bg-success" : "bg-muted-foreground/50"}`}
        title={online ? "Online" : "Offline"}
      />
    </div>
  );
}

/**
 * Draws one built-in avatar. Everything is vector geometry in a 100×100 box, so
 * it stays crisp at any size and adds no image payload to the app or the
 * database. Unknown ids render nothing — callers use <Avatar> which falls back
 * to initials.
 */
export function AvatarArt({ id, className }: { id: string; className?: string }) {
  const spec = avatarSpec(id);
  if (!spec) return null;
  const draw = ART[spec.art];
  return (
    <svg viewBox="0 0 100 100" className={className} role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id={`av-${spec.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={spec.palette.from} />
          <stop offset="1" stopColor={spec.palette.to} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#av-${spec.id})`} />
      <circle cx="21" cy="17" r="17" fill="#ffffff" opacity="0.14" />
      <circle cx="85" cy="80" r="21" fill="#ffffff" opacity="0.1" />
      {draw(spec.palette)}
    </svg>
  );
}

const EYES = (p: AvatarPalette, x1 = 41, x2 = 59, y = 54, rx = 4.1, ry = 4.9): ReactNode => (
  <>
    <ellipse cx={x1} cy={y} rx={rx} ry={ry} fill={p.ink} />
    <ellipse cx={x2} cy={y} rx={rx} ry={ry} fill={p.ink} />
    <circle cx={x1 + 1.3} cy={y - 1.6} r="1.3" fill="#ffffff" opacity="0.85" />
    <circle cx={x2 + 1.3} cy={y - 1.6} r="1.3" fill="#ffffff" opacity="0.85" />
  </>
);

/** The little "w" muzzle most of the animals share. */
const SMILE = (p: AvatarPalette, y = 72, w = 8): ReactNode => (
  <path
    d={`M50 ${y} v3 M50 ${y + 3} q-${w * 0.55} ${w * 0.55} -${w} 0 M50 ${y + 3} q${w * 0.55} ${w * 0.55} ${w} 0`}
    stroke={p.ink}
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
  />
);

const BLUSH = (p: AvatarPalette, y = 66, x = 30): ReactNode => (
  <>
    <ellipse cx={x} cy={y} rx="5.2" ry="3.4" fill={p.accent} opacity="0.5" />
    <ellipse cx={100 - x} cy={y} rx="5.2" ry="3.4" fill={p.accent} opacity="0.5" />
  </>
);

const ART: Record<AvatarArtKey, (p: AvatarPalette) => ReactNode> = {
  cat: (p) => (
    <>
      <path d="M28 40 L23 18 L45 29 Z" fill={p.face} />
      <path d="M72 40 L77 18 L55 29 Z" fill={p.face} />
      <path d="M31 37 L28 24 L40 30 Z" fill={p.accent} />
      <path d="M69 37 L72 24 L60 30 Z" fill={p.accent} />
      <ellipse cx="50" cy="58" rx="30" ry="26" fill={p.face} />
      <path
        d="M24 60 h9 M24 67 h9 M76 60 h-9 M76 67 h-9"
        stroke={p.ink}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.4"
      />
      {EYES(p, 41, 59, 55)}
      <path d="M47 65 h6 l-3 3.2 z" fill={p.accent} />
      {SMILE(p, 69, 7)}
      {BLUSH(p, 68, 32)}
    </>
  ),

  bear: (p) => (
    <>
      <circle cx="25" cy="30" r="13" fill={p.face} />
      <circle cx="75" cy="30" r="13" fill={p.face} />
      <circle cx="25" cy="30" r="6.4" fill={p.accent} />
      <circle cx="75" cy="30" r="6.4" fill={p.accent} />
      <circle cx="50" cy="58" r="29" fill={p.face} />
      <ellipse cx="50" cy="68" rx="17" ry="12.5" fill={p.accent} opacity="0.45" />
      {EYES(p, 41, 59, 54)}
      <ellipse cx="50" cy="64" rx="5.4" ry="4" fill={p.ink} />
      {SMILE(p, 69, 8)}
    </>
  ),

  fox: (p) => (
    <>
      <path d="M22 42 L17 15 L44 28 Z" fill={p.face} />
      <path d="M78 42 L83 15 L56 28 Z" fill={p.face} />
      <path d="M26 38 L24 21 L37 29 Z" fill={p.accent} />
      <path d="M74 38 L76 21 L63 29 Z" fill={p.accent} />
      <path d="M50 30 C68 30 78 42 78 56 C78 74 66 86 50 86 C34 86 22 74 22 56 C22 42 32 30 50 30 Z" fill={p.face} />
      <path
        d="M50 60 C63 60 69 69 65 78 C62 84 56 86 50 86 C44 86 38 84 35 78 C31 69 37 60 50 60 Z"
        fill="#ffffff"
        opacity="0.75"
      />
      {EYES(p, 41, 59, 52)}
      <ellipse cx="50" cy="68" rx="5" ry="3.8" fill={p.ink} />
      {SMILE(p, 73, 7)}
    </>
  ),

  bunny: (p) => (
    <>
      <ellipse cx="35" cy="25" rx="7.6" ry="19" fill={p.face} transform="rotate(-13 35 25)" />
      <ellipse cx="65" cy="25" rx="7.6" ry="19" fill={p.face} transform="rotate(13 65 25)" />
      <ellipse cx="35" cy="26" rx="3.4" ry="12" fill={p.accent} transform="rotate(-13 35 26)" />
      <ellipse cx="65" cy="26" rx="3.4" ry="12" fill={p.accent} transform="rotate(13 65 26)" />
      <circle cx="50" cy="60" r="27" fill={p.face} />
      {EYES(p, 41, 59, 56)}
      <ellipse cx="50" cy="66" rx="4.2" ry="3.1" fill={p.accent} />
      {SMILE(p, 70, 6.5)}
      {BLUSH(p, 69, 32)}
    </>
  ),

  panda: (p) => (
    <>
      <circle cx="24" cy="28" r="12" fill={p.ink} />
      <circle cx="76" cy="28" r="12" fill={p.ink} />
      <circle cx="50" cy="58" r="30" fill={p.face} />
      <ellipse cx="36" cy="54" rx="8.6" ry="10.6" fill={p.ink} transform="rotate(-18 36 54)" />
      <ellipse cx="64" cy="54" rx="8.6" ry="10.6" fill={p.ink} transform="rotate(18 64 54)" />
      <circle cx="37" cy="54" r="3.4" fill="#ffffff" />
      <circle cx="63" cy="54" r="3.4" fill="#ffffff" />
      <circle cx="38" cy="52.8" r="1.2" fill={p.ink} />
      <circle cx="64" cy="52.8" r="1.2" fill={p.ink} />
      <ellipse cx="50" cy="68" rx="4.6" ry="3.4" fill={p.ink} />
      {SMILE(p, 72, 6.5)}
    </>
  ),

  pup: (p) => (
    <>
      <ellipse cx="20" cy="52" rx="10.5" ry="21" fill={p.accent} transform="rotate(9 20 52)" />
      <ellipse cx="80" cy="52" rx="10.5" ry="21" fill={p.accent} transform="rotate(-9 80 52)" />
      <circle cx="50" cy="56" r="28" fill={p.face} />
      <ellipse cx="50" cy="70" rx="16" ry="11.5" fill="#ffffff" opacity="0.7" />
      {EYES(p, 41, 59, 51)}
      <ellipse cx="50" cy="64" rx="5" ry="3.8" fill={p.ink} />
      {SMILE(p, 69, 7.5)}
    </>
  ),

  owl: (p) => (
    <>
      <path d="M24 34 L19 13 L41 24 Z" fill={p.face} />
      <path d="M76 34 L81 13 L59 24 Z" fill={p.face} />
      <circle cx="50" cy="56" r="30" fill={p.face} />
      <circle cx="38" cy="52" r="12" fill="#ffffff" opacity="0.7" />
      <circle cx="62" cy="52" r="12" fill="#ffffff" opacity="0.7" />
      <circle cx="38" cy="52" r="5.4" fill={p.ink} />
      <circle cx="62" cy="52" r="5.4" fill={p.ink} />
      <circle cx="39.6" cy="50.4" r="1.8" fill="#ffffff" />
      <circle cx="63.6" cy="50.4" r="1.8" fill="#ffffff" />
      <path d="M50 60 l6.5 8 h-13 z" fill={p.accent} />
      <path d="M34 76 q16 9 32 0" stroke={p.ink} strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.4" />
    </>
  ),

  penguin: (p) => (
    <>
      <ellipse cx="50" cy="56" rx="30" ry="31" fill={p.ink} />
      <ellipse cx="50" cy="62" rx="21" ry="23" fill="#ffffff" opacity="0.92" />
      <ellipse cx="41" cy="51" rx="4.1" ry="4.9" fill={p.ink} />
      <ellipse cx="59" cy="51" rx="4.1" ry="4.9" fill={p.ink} />
      <circle cx="42.3" cy="49.4" r="1.3" fill="#ffffff" />
      <circle cx="60.3" cy="49.4" r="1.3" fill="#ffffff" />
      <path d="M50 57 l7 5 -7 5 -7 -5 z" fill={p.accent} />
      <path d="M22 42 q5 26 11 33" stroke="#ffffff" strokeWidth="2.6" fill="none" opacity="0.3" strokeLinecap="round" />
      <path d="M78 42 q-5 26 -11 33" stroke="#ffffff" strokeWidth="2.6" fill="none" opacity="0.3" strokeLinecap="round" />
      <ellipse cx="28" cy="66" rx="4.6" ry="3" fill={p.accent} opacity="0.5" />
      <ellipse cx="72" cy="66" rx="4.6" ry="3" fill={p.accent} opacity="0.5" />
    </>
  ),

  frog: (p) => (
    <>
      <circle cx="30" cy="32" r="14" fill={p.face} />
      <circle cx="70" cy="32" r="14" fill={p.face} />
      <circle cx="30" cy="32" r="7.5" fill="#ffffff" />
      <circle cx="70" cy="32" r="7.5" fill="#ffffff" />
      <circle cx="30" cy="32.5" r="3.6" fill={p.ink} />
      <circle cx="70" cy="32.5" r="3.6" fill={p.ink} />
      <circle cx="31.2" cy="31" r="1.1" fill="#ffffff" />
      <circle cx="71.2" cy="31" r="1.1" fill="#ffffff" />
      <ellipse cx="50" cy="62" rx="30" ry="24" fill={p.face} />
      <path d="M30 62 q20 16 40 0" stroke={p.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="22" cy="70" rx="5.4" ry="3.6" fill={p.accent} opacity="0.45" />
      <ellipse cx="78" cy="70" rx="5.4" ry="3.6" fill={p.accent} opacity="0.45" />
    </>
  ),

  robot: (p) => (
    <>
      <path d="M50 13 v11" stroke={p.ink} strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="11" r="4.6" fill={p.accent} />
      <rect x="13" y="45" width="8" height="18" rx="4" fill={p.accent} />
      <rect x="79" y="45" width="8" height="18" rx="4" fill={p.accent} />
      <rect x="22" y="26" width="56" height="52" rx="16" fill={p.face} />
      <rect x="32" y="42" width="14" height="12" rx="5.5" fill={p.ink} />
      <rect x="54" y="42" width="14" height="12" rx="5.5" fill={p.ink} />
      <circle cx="37" cy="46" r="1.9" fill="#ffffff" opacity="0.8" />
      <circle cx="59" cy="46" r="1.9" fill="#ffffff" opacity="0.8" />
      <rect x="38" y="62" width="24" height="7.5" rx="3.75" fill={p.accent} />
      <path d="M44 65.8 h12" stroke={p.face} strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),

  alien: (p) => (
    <>
      <path d="M50 12 C72 12 80 34 78 54 C76 76 64 88 50 88 C36 88 24 76 22 54 C20 34 28 12 50 12 Z" fill={p.face} />
      <ellipse cx="37" cy="50" rx="9" ry="12" fill={p.ink} transform="rotate(-16 37 50)" />
      <ellipse cx="63" cy="50" rx="9" ry="12" fill={p.ink} transform="rotate(16 63 50)" />
      <ellipse cx="34" cy="45.5" rx="2.8" ry="3.8" fill="#ffffff" opacity="0.85" transform="rotate(-16 34 45.5)" />
      <ellipse cx="60" cy="45.5" rx="2.8" ry="3.8" fill="#ffffff" opacity="0.85" transform="rotate(16 60 45.5)" />
      <path d="M45 70 q5 5 10 0" stroke={p.ink} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="21" r="3" fill={p.accent} opacity="0.6" />
      {BLUSH(p, 64, 25)}
    </>
  ),

  astro: (p) => (
    <>
      <rect x="39" y="12" width="22" height="10" rx="4.5" fill={p.accent} />
      <circle cx="50" cy="54" r="33" fill={p.face} />
      <ellipse cx="50" cy="56" rx="21.5" ry="19.5" fill={p.ink} opacity="0.93" />
      <ellipse cx="42" cy="48" rx="5" ry="7" fill="#ffffff" opacity="0.28" transform="rotate(-20 42 48)" />
      <circle cx="44" cy="60" r="2.7" fill={p.accent} />
      <circle cx="56" cy="60" r="2.7" fill={p.accent} />
      <path d="M44.5 68 q5.5 4.5 11 0" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.9" />
      <ellipse cx="31" cy="60" rx="4.4" ry="2.8" fill={p.accent} opacity="0.45" />
      <ellipse cx="69" cy="60" rx="4.4" ry="2.8" fill={p.accent} opacity="0.45" />
    </>
  ),

  ghost: (p) => (
    <>
      <path
        d="M50 13 C68 13 78 29 78 49 V83 q-7 -7 -14 0 q-7 -7 -14 0 q-7 -7 -14 0 q-7 -7 -14 0 V49 C22 29 32 13 50 13 Z"
        fill={p.face}
      />
      <ellipse cx="41" cy="46" rx="4.4" ry="5.6" fill={p.ink} />
      <ellipse cx="59" cy="46" rx="4.4" ry="5.6" fill={p.ink} />
      <ellipse cx="50" cy="60" rx="5" ry="6" fill={p.ink} opacity="0.85" />
      {BLUSH(p, 58, 29)}
    </>
  ),

  star: (p) => (
    <>
      <path
        d="M50 11 L61 36 L88 39 L68 58 L73 86 L50 73 L27 86 L32 58 L12 39 L39 36 Z"
        fill={p.face}
        strokeLinejoin="round"
      />
      {EYES(p, 41, 59, 46, 3.7, 4.4)}
      <path d="M42 58 q8 8 16 0" stroke={p.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="33" cy="55" rx="4" ry="2.6" fill={p.accent} opacity="0.5" />
      <ellipse cx="67" cy="55" rx="4" ry="2.6" fill={p.accent} opacity="0.5" />
    </>
  ),

  sprout: (p) => (
    <>
      <path d="M50 36 V16" stroke={p.accent} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M50 20 C40 20 30 14 30 8 C40 6 48 12 50 20 Z" fill={p.accent} opacity="0.85" />
      <path d="M50 27 C60 27 70 21 70 15 C60 13 52 19 50 27 Z" fill={p.accent} opacity="0.6" />
      <circle cx="50" cy="61" r="28" fill={p.face} />
      {EYES(p, 41, 59, 57)}
      <path d="M43 69 q7 7 14 0" stroke={p.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {BLUSH(p, 70, 31)}
    </>
  ),

  geometer: (p) => (
    <>
      <rect x="17" y="17" width="66" height="66" rx="22" fill={p.face} />
      <path
        d="M33 45 h13 M54 45 h13"
        stroke={p.ink}
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path d="M38 63 q12 9 24 0" stroke={p.ink} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="29" r="3.2" fill={p.accent} />
      <path d="M26 74 q24 8 48 0" stroke={p.accent} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.35" />
    </>
  ),
};

function shade(hex: string, pct: number): string {
  const c = hex.replace("#", "");
  const num = parseInt(c.length === 3 ? c.split("").map((x) => x + x).join("") : c, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const f = pct / 100;
  r = Math.round(r + (f >= 0 ? 255 - r : r) * f);
  g = Math.round(g + (f >= 0 ? 255 - g : g) * f);
  b = Math.round(b + (f >= 0 ? 255 - b : b) * f);
  return `#${[r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("")}`;
}
