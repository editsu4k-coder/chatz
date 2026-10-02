// Unicode-safe rules for text users write into their profile (name, bio).
//
// Emoji are sequences, not characters: "🔥" is one user-perceived character but
// two UTF-16 code units, and "👨‍👩‍👧" is seven. Counting and cutting with
// .length corrupts them (splitting a surrogate pair renders "�"), so everything
// here works in graphemes via Intl.Segmenter.

export const NAME_MAX = 30;
export const BIO_MAX = 160;

/** Split into user-perceived characters — an emoji with its modifiers counts once.
 *  Intl.Segmenter needs Chrome 87+; the code-point fallback keeps older WebViews
 *  from throwing (they may split emoji modifiers, but never crash). */
const segmenter: { segment: (s: string) => Iterable<{ segment: string }> } | null = (() => {
  try {
    if (typeof Intl !== "undefined" && typeof (Intl as { Segmenter?: unknown }).Segmenter === "function") {
      return new (Intl as unknown as { Segmenter: new (l: undefined, o: { granularity: "grapheme" }) => { segment: (s: string) => Iterable<{ segment: string }> } })(undefined, { granularity: "grapheme" });
    }
  } catch {
    /* fall through to the code-point splitter */
  }
  return null;
})();

export function graphemes(s: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(s), (x) => x.segment);
  return Array.from(s);
}

export function graphemeLength(s: string): number {
  return graphemes(s).length;
}

/** Cut to at most `max` graphemes without ever splitting one. */
export function clampGraphemes(s: string, max: number): string {
  const parts = graphemes(s);
  return parts.length <= max ? s : parts.slice(0, max).join("");
}

// Invisible formatting that lets text misrepresent itself: bidi overrides,
// zero-width spaces, the BOM. ZWJ/ZWNJ (U+200C/200D) and the variation selector
// are deliberately NOT here — emoji and Indic scripts need them.
const INVISIBLE = /[\u061C\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;
const SINGLE_LINE_CONTROLS = /[\u0000-\u001F\u007F-\u009F]/g;
const LINE_BREAKS = /\r\n?/g;
const MULTILINE_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/**
 * Drop characters no keyboard can type and no reader should receive. Single-line
 * text turns them into spaces; multiline keeps real line breaks.
 */
export function stripUnsafe(raw: string, opts?: { multiline?: boolean }): string {
  if (opts?.multiline) {
    return raw
      .replace(LINE_BREAKS, "\n")
      .replace(MULTILINE_CONTROLS, "")
      .replace(INVISIBLE, "")
      .replace(/\u00A0/g, " ");
  }
  return raw.replace(SINGLE_LINE_CONTROLS, " ").replace(INVISIBLE, "").replace(/\u00A0/g, " ");
}

/** Normalise a display name for storage: no unsafe chars, single spaces, trimmed. */
export function cleanName(raw: string): string {
  return stripUnsafe(raw).replace(/\s+/g, " ").trim();
}

/** Normalise a bio for storage: safe chars, tidy line breaks, trimmed. */
export function cleanBio(raw: string): string {
  return stripUnsafe(raw, { multiline: true })
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Validation message for a display name, or null when it is fine. */
export function nameProblem(raw: string): string | null {
  const clean = cleanName(raw);
  if (!clean) return "Enter a display name.";
  if (graphemeLength(clean) > NAME_MAX) {
    return `Display names can be at most ${NAME_MAX} characters — emoji count as one.`;
  }
  return null;
}
