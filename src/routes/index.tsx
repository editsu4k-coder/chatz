import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatZMark } from "@/components/Logo";
import { authErrorMessage, onAuthChange, signInWithGoogle } from "@/lib/auth";
import { resolveSession } from "@/lib/session";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChatZ — Connect. Chat. Better." },
      {
        name: "description",
        content:
          "ChatZ is a tight-circle social app for sharing daily screen-time stats with the friends who get it.",
      },
      { property: "og:title", content: "ChatZ" },
      { property: "og:description", content: "Connect. Chat. Better." },
    ],
  }),
  component: Landing,
});

const GOOGLE_REASONS = [
  "One tap, no passwords to remember",
  "Your handle is bound to this account",
  "We never post anything on your behalf",
];

function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Holds the splash surface until Firebase answers, so the login UI never
  // flashes before a restored session navigates away.
  const [checking, setChecking] = useState(true);
  // Guards the auto-restore listener while a manual sign-in is in flight.
  const busyRef = useRef(false);
  const doneRef = useRef(false);
  const firedRef = useRef(false);

  /** The one place that turns a Firebase user into a destination. */
  const enter = useCallback(
    async (user: User) => {
      const session = await resolveSession(user);
      if (doneRef.current) return;
      if (session.state === "ready") {
        doneRef.current = true;
        navigate({ to: "/app" });
      } else if (session.state === "onboarding") {
        doneRef.current = true;
        navigate({ to: "/onboarding" });
      } else if (session.state === "unknown") {
        setError("Couldn't load your profile. Check your connection and try again.");
        setChecking(false);
      }
    },
    [navigate],
  );

  // A session restored from a previous run must not sit on the splash screen.
  useEffect(() => {
    return onAuthChange((user) => {
      firedRef.current = true;
      if (!user || doneRef.current) {
        if (!busyRef.current && !doneRef.current) setChecking(false);
        return;
      }
      if (busyRef.current || doneRef.current) return;
      enter(user).catch(() => {});
    });
  }, [enter]);

  // If Firebase never answers, fall back to the login UI instead of hanging.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!firedRef.current) setChecking(false);
    }, 6000);
    return () => window.clearTimeout(t);
  }, []);

  const doGoogle = async () => {
    setLoading(true);
    busyRef.current = true;
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) await enter(user); // null means the account picker was dismissed
    } catch (err: unknown) {
      setError(authErrorMessage(err));
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#000000] grid place-items-center">
        <ChatZMark size={288} glyphOnly fg="#FFFFFF" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8 relative">
          <div className="rounded-[28px] overflow-hidden shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] inline-flex bg-[#0A0A0A]">
            <ChatZMark size={108} fg="#FFFFFF" />
          </div>
        </div>
        <h1 className="text-[2.5rem] leading-[1.05] font-semibold tracking-tight max-w-sm">
          Chat<span className="font-bold">Z</span>
          <span className="block text-[1.05rem] font-normal text-muted-foreground mt-3 tracking-normal">
            Connect. Chat. Better.
          </span>
        </h1>
        <p className="mt-4 text-muted-foreground max-w-xs text-[15px] leading-relaxed">
          A tiny circle of friends. Daily screen-time stats you can share. No judgement, just vibes.
        </p>

        <div className="mt-10 w-full max-w-sm flex flex-col gap-3">
          <button
            onClick={doGoogle}
            disabled={loading}
            className="w-full h-12 rounded-full bg-foreground text-background font-medium text-[15px] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <GoogleG />
            {loading ? "Signing in…" : "Continue with Google"}
          </button>
          {error && (
            <p role="alert" className="text-[13px] text-destructive px-1">
              {error}
            </p>
          )}
        </div>

        <ul className="mt-8 space-y-2 text-left">
          {GOOGLE_REASONS.map((reason) => (
            <li key={reason} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
              <span className="mt-[6px] size-1.5 rounded-full bg-primary shrink-0" />
              {reason}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs text-muted-foreground max-w-[280px] leading-relaxed">
          ChatZ uses your Google account only to identify you. Your name, handle and avatar are
          yours to choose.
        </p>
      </main>
      <footer className="text-center text-xs text-muted-foreground pb-6">
        ChatZ · You control what you share
      </footer>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
