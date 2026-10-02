// ChatZ wordmark + app icon, rendered as inline SVG.
// The mark fills the entire viewBox so the surrounding container (or platform
// icon mask) controls the corner rounding — no stray transparent corners.

export function ChatZMark({
  size = 64,
  rounded = 0,
  bg = "#0A0A0A",
  fg = "#FFFFFF",
  glyphOnly = false,
  className = "",
}: {
  size?: number;
  rounded?: number;
  bg?: string;
  fg?: string;
  glyphOnly?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      aria-hidden
    >
      {!glyphOnly && (
        <rect width="120" height="120" rx={rounded} ry={rounded} fill={bg} />
      )}
      {/* speech bubble outline */}
      <path
        d="M62 22c20.4 0 36 14.3 36 32 0 17.7-15.6 32-36 32-3.6 0-7.1-.5-10.3-1.3l-13.4 8.2c-1.6 1-3.7-.3-3.4-2.2l1.9-11.9C29.5 73.4 26 65.6 26 54c0-17.7 15.6-32 36-32z"
        fill="none"
        stroke={fg}
        strokeWidth="6.5"
        strokeLinejoin="round"
      />
      {/* bold Z */}
      <path
        d="M48 42h32l-22 28h22"
        fill="none"
        stroke={fg}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatZWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="rounded-[10px] overflow-hidden bg-foreground text-background flex">
        <ChatZMark size={32} glyphOnly bg="transparent" fg="currentColor" />
      </span>
      <span className="text-[20px] font-semibold tracking-tight">
        Chat<span className="font-bold">Z</span>
      </span>
    </div>
  );
}
