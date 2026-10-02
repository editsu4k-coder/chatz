import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AVATAR_COLORS, useProfile } from "@/lib/profile-store";
import { HandleTakenError, isOfflineError, saveOnboardingProfile } from "@/lib/profile-repo";
import { getUser } from "@/lib/auth";
import { HANDLE_MIN, handleProblem } from "@/lib/handle";
import {
  BIO_MAX,
  NAME_MAX,
  clampGraphemes,
  cleanBio,
  cleanName,
  graphemeLength,
  nameProblem,
  stripUnsafe,
} from "@/lib/text";
import { AvatarPicker } from "@/components/AvatarPicker";
import { RestrictedSettingsNote } from "@/components/RestrictedSettingsNote";
import {
  Bell,
  BarChart3,
  Check,
  ExternalLink,
  Loader2,
  BatteryCharging,
  X,
} from "lucide-react";
import { VibeStats } from "@/lib/vibe-stats";
import { useHandleAvailability } from "@/lib/use-handle-availability";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile · ChatZ" }] }),
  component: Onboarding,
});

const STEPS = 5;

function Onboarding() {
  const navigate = useNavigate();
  const profile = useProfile();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [dob, setDob] = useState("");
  const [education, setEducation] = useState("");
  const [bio, setBio] = useState("");
  const [color, setColor] = useState(AVATAR_COLORS[1]);
  const [avatarId, setAvatarId] = useState<string | undefined>(undefined);
  const [goalHours, setGoalHours] = useState(4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | undefined>(undefined);
  // The wizard asks for all three permissions here, but never traps the user:
  // Continue unlocks on real grants or on an explicit "skip for now".
  const [permsOk, setPermsOk] = useState(false);

  // Reached only by deep link: a completed profile never routes here.
  const completed = Boolean(profile?.hasOnboarded);
  useEffect(() => {
    if (completed) navigate({ to: "/app", replace: true });
  }, [completed, navigate]);

  // The uid feeds the handle-availability probe; identity still comes from
  // Firebase Auth at save time in finish().
  useEffect(() => {
    getUser()
      .then((u) => setUid(u?.uid))
      .catch(() => {});
  }, []);

  const handleIssue = handleProblem(handle);
  const handleAvailability = useHandleAvailability(handle, uid);
  const nameIssue = nameProblem(name);
  const nameCount = graphemeLength(cleanName(name));

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // Identity comes from Firebase Auth, never from the local cache.
      const user = await getUser();
      if (!user) {
        setError("Your session expired. Please sign in again.");
        return;
      }

      const displayName = cleanName(name) || profile?.name || "";
      const problem = nameProblem(displayName);
      if (problem) {
        setError(problem);
        return;
      }
      const parts = displayName.split(/\s+/).filter(Boolean);

      await saveOnboardingProfile(user.uid, {
        name: displayName,
        handle,
        color,
        avatarId,
        goalHours,
        bio: cleanBio(bio) || undefined,
        firstName: parts[0],
        lastName: parts.slice(1).join(" ") || undefined,
        dob: dob || undefined,
        education: education.trim() || undefined,
        email: user.email ?? profile?.email ?? undefined,
      });

      // Firestore is now the truth; the shell re-reads it and refreshes the cache.
      navigate({ to: "/app", replace: true });
    } catch (err) {
      if (err instanceof HandleTakenError) {
        setStep(0);
        setError(err.message);
      } else if (isOfflineError(err)) {
        setError("No connection. Your profile wasn't saved — check your network and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Couldn't save your profile. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 pt-6 pb-2 flex items-center gap-3">
        <button
          onClick={() => (step === 0 ? navigate({ to: "/" }) : setStep(step - 1))}
          className="text-primary text-[15px] font-medium"
        >
          ‹ Back
        </button>
        <div className="flex-1 flex justify-center gap-1.5">
          {Array.from({ length: STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1 w-7 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>
        <div className="w-12" />
      </header>

      <main className="flex-1 px-6 pt-8 pb-8 flex flex-col">
        {step === 0 && (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-semibold tracking-tight">What should we call you?</h1>
            <p className="mt-2 text-muted-foreground text-[15px]">
              Your handle is how friends find and add you. You can change it later.
            </p>
            <div className="mt-8 space-y-3">
              <Field label="Display name">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(stripUnsafe(e.target.value))}
                    placeholder="Alex Rivera"
                    className="flex-1 min-w-0 bg-transparent outline-none text-[17px]"
                  />
                  <span
                    className={`text-[11px] tabular-nums shrink-0 ${
                      nameCount > NAME_MAX ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    {nameCount}/{NAME_MAX}
                  </span>
                </div>
              </Field>
              {name.trim() !== "" && nameIssue && (
                <p role="alert" className="px-1 text-[12px] text-destructive">
                  {nameIssue}
                </p>
              )}
              <Field label="Handle">
                <div className="flex items-center gap-1 w-full">
                  <span className="text-muted-foreground text-[17px]">@</span>
                  <input
                    value={handle}
                    onChange={(e) =>
                      setHandle(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())
                    }
                    placeholder="alex"
                    className="flex-1 bg-transparent outline-none text-[17px]"
                  />
                </div>
              </Field>
              <p className="px-1 text-[12px] text-muted-foreground">
                {handle.length === 0 ? (
                  `At least ${HANDLE_MIN} characters — letters, numbers and underscores.`
                ) : handleIssue ? (
                  handleIssue
                ) : handleAvailability === "checking" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 size={13} className="animate-spin" /> Checking availability…
                  </span>
                ) : handleAvailability === "available" ? (
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <Check size={13} /> @{handle} is available
                  </span>
                ) : handleAvailability === "taken" ? (
                  <span className="inline-flex items-center gap-1.5 text-destructive">
                    <X size={13} /> This handle is already taken
                  </span>
                ) : (
                  `@${handle}`
                )}
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-semibold tracking-tight">Your avatar</h1>
            <p className="mt-2 text-muted-foreground text-[15px]">
              Pick the one that feels like you. You can change it any time.
            </p>

            <div className="mt-6">
              <AvatarPicker value={avatarId} onSelect={setAvatarId} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-semibold tracking-tight">About you</h1>
            <p className="mt-2 text-muted-foreground text-[15px]">
              Optional, and only visible to you — friends never see these.
            </p>
            <div className="mt-8 space-y-3">
              <Field label="Date of birth">
                <input
                  type="date"
                  value={dob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-transparent outline-none text-[17px]"
                />
              </Field>
              <Field label="Education">
                <input
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="e.g. BSc Computer Science, NYU"
                  className="w-full bg-transparent outline-none text-[17px]"
                />
              </Field>
              <Field label="Bio">
                <textarea
                  value={bio}
                  onChange={(e) =>
                    setBio(
                      clampGraphemes(
                        stripUnsafe(e.target.value, { multiline: true }),
                        BIO_MAX,
                      ),
                    )
                  }
                  rows={3}
                  placeholder="A short note about you"
                  className="w-full bg-transparent outline-none text-[15px] resize-none"
                />
                <div className="text-right text-[11px] text-muted-foreground tabular-nums">
                  {graphemeLength(bio)}/{BIO_MAX}
                </div>
              </Field>
            </div>
          </div>
        )}

        {step === 3 && <PermissionsStep onState={setPermsOk} />}

        {step === 4 && (
          <div className="flex-1 flex flex-col">
            <h1 className="text-3xl font-semibold tracking-tight">Daily goal</h1>
            <p className="mt-2 text-muted-foreground text-[15px]">
              Set a soft target for your screen time. We'll never shame you.
            </p>
            <div className="mt-12 flex flex-col items-center">
              <div className="text-6xl font-semibold tabular-nums">
                {goalHours}
                <span className="text-2xl text-muted-foreground font-normal">h</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={goalHours}
                onChange={(e) => setGoalHours(Number(e.target.value))}
                className="mt-8 w-full accent-[var(--color-primary)]"
              />
              <div className="w-full flex justify-between text-xs text-muted-foreground mt-1">
                <span>1h</span>
                <span>10h</span>
              </div>
            </div>
            <div className="mt-10 rounded-2xl bg-secondary p-4 text-[13px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Privacy note. </span>
              Your stats are shared only with friends you accept, and only the parts you allow in
              Profile → Privacy. You can turn any of it off at any time.
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-destructive px-1 text-center">
            {error}
          </p>
        )}

        <button
          onClick={() => {
            setError(null);
            if (step === STEPS - 1) finish();
            else setStep(step + 1);
          }}
          disabled={
            saving ||
            (step === 0 && Boolean(nameIssue || handleIssue)) ||
            (step === 3 && !permsOk)
          }
          className="mt-8 h-12 rounded-full bg-primary text-primary-foreground font-medium text-[15px] grid place-items-center active:scale-[0.98] transition disabled:opacity-40"
        >
          {step === STEPS - 1 ? (saving ? "Setting up…" : "Get started") : "Continue"}
        </button>
      </main>
    </div>
  );
}

// --- Permissions step with deep-link buttons + data-usage guide ---
type Perm = {
  id: string;
  label: string;
  sub: string;
  required: boolean;
  icon: React.ReactNode;
  androidNote?: string;
};

const PERMS: Perm[] = [
  {
    id: "usage",
    label: "Screen-time access",
    sub: "Read your real daily phone usage and share it with friends",
    required: true,
    icon: <BarChart3 size={18} />,
    androidNote: "Opens Usage Access — find ChatZ and toggle ON",
  },
  {
    id: "notifs",
    label: "Notifications",
    sub: "Get alerts for messages, reactions and friend requests",
    required: true,
    icon: <Bell size={18} />,
    androidNote: "Opens Android notification settings for ChatZ",
  },
  {
    id: "background",
    label: "Background activity",
    sub: "Stops Android from freezing ChatZ so stats keep syncing",
    required: true,
    icon: <BatteryCharging size={18} />,
    androidNote: "Find ChatZ and choose 'Don't optimize' / allow background activity",
  },
];

function PermissionsStep({ onState }: { onState: (ok: boolean) => void }) {
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [opening, setOpening] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Skipping is a first-class choice: ChatZ runs degraded and says so, instead
  // of trapping the user on this step until every OEM settings screen cooperates.
  const [skipped, setSkipped] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // The app shell's permission gate reads this same flag; writing it here means
  // a user who chose limited access in onboarding is not blocked a second time
  // the moment they reach Home. The shell clears the flag on a full grant.
  const setSkippedEverywhere = (v: boolean) => {
    setSkipped(v);
    try {
      if (v) localStorage.setItem("chatz.perms.gateDismissed", "1");
      else localStorage.removeItem("chatz.perms.gateDismissed");
    } catch {
      /* private mode */
    }
  };

  // Tell the wizard whether the Continue button may unlock. Web preview has no
  // real OS permissions, so it passes; native passes on three real grants or
  // on an explicit skip.
  useEffect(() => {
    onState(skipped || !isNative || PERMS.every((p) => granted.has(p.id)));
  }, [granted, isNative, skipped, onState]);

  // Re-read the real OS permission state so the checklist never lies about
  // what the user actually granted.
  const recheck = useCallback(async () => {
    if (!isNative) return;
    const next = new Set<string>();
    for (const perm of PERMS) {
      try {
        const res =
          perm.id === "usage"
            ? await VibeStats.checkUsageAccess()
            : perm.id === "background"
              ? await VibeStats.checkBatteryOptimization()
              : await VibeStats.checkPermission({ action: perm.id });
        if (res.granted) next.add(perm.id);
      } catch {
        // ignore individual check failures
      }
    }
    setGranted(next);
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return;
    recheck();
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) recheck();
    });
    return () => {
      sub.then((h) => h.remove()).catch(() => {});
    };
  }, [isNative, recheck]);

  const open = async (p: Perm) => {
    setOpening(p.id);
    try {
      if (isNative) {
        // Battery optimization is not a runtime permission — it opens the
        // manufacturer's battery screen; state is confirmed by recheck() on return.
        let result: { granted: boolean; needsSettings?: boolean };
        if (p.id === "background") {
          await VibeStats.requestBatteryOptimization();
          result = { granted: false, needsSettings: true };
        } else {
          result = await VibeStats.requestPermission({ action: p.id });
        }
        if (result.granted) {
          setGranted((s) => new Set(s).add(p.id));
        } else if (result.needsSettings === false) {
          // The runtime dialog was shown and denied, but Android can ask again —
          // nothing opened, so the toast must not claim a settings screen did.
          setToast("Not granted — you can allow it when Android asks again");
          setTimeout(() => setToast(null), 3000);
        } else {
          // Settings screen opened; the item is confirmed only after recheck()
          // runs when the user returns to the app.
          setToast(p.androidNote || "Look for ChatZ in the settings list");
          setTimeout(() => setToast(null), 3000);
        }
      } else {
        setToast("Permissions not available in browser — mark as granted for preview");
        setTimeout(() => setToast(null), 2500);
        setTimeout(() => {
          setGranted((s) => new Set(s).add(p.id));
        }, 600);
      }
    } catch (err) {
      console.error("Failed to request permission", err);
      setToast("Couldn't request permission — check manually in Settings.");
      setTimeout(() => setToast(null), 3000);
    }
    setOpening(null);
  };

  return (
    <div className="flex-1 flex flex-col">
      <h1 className="text-3xl font-semibold tracking-tight">Permissions</h1>
      <p className="mt-2 text-muted-foreground text-[15px]">
        All three are needed for ChatZ to work at its best. Tap each one to jump straight into
        your phone's settings — or skip and grant them later.
      </p>

      <ul className="mt-6 space-y-2">
        {PERMS.map((p) => {
          const done = granted.has(p.id);
          const isOpening = opening === p.id;
          return (
            <li key={p.id}>
              <button
                onClick={() => open(p)}
                className={`w-full bg-surface border rounded-2xl p-3.5 flex items-center gap-3 active:scale-[0.99] transition-all ${
                  done
                    ? "border-success/40 bg-success/5"
                    : isOpening
                      ? "border-primary/40 bg-primary/5"
                      : "border-border"
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full grid place-items-center transition-colors ${
                    done
                      ? "bg-success/15 text-success"
                      : isOpening
                        ? "bg-primary/15 text-primary animate-pulse"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {done ? <Check size={18} /> : p.icon}
                </span>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-[15px] font-medium flex items-center gap-1.5">
                    {p.label}
                    {p.required && (
                      <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                        Needed
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {isOpening ? "Opening settings..." : done ? "Allowed" : p.sub}
                  </div>
                </div>
                <span
                  className={done ? "text-success" : isOpening ? "text-primary" : "text-primary"}
                >
                  {done ? <Check size={16} /> : <ExternalLink size={16} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {isNative && !granted.has("usage") && <RestrictedSettingsNote className="mt-4" />}

      <button
        onClick={() => setSkippedEverywhere(!skipped)}
        className={`mt-5 h-11 rounded-full border text-[14px] font-medium active:scale-[0.98] transition ${
          skipped ? "border-primary/40 text-primary bg-primary/5" : "border-border text-muted-foreground"
        }`}
      >
        {skipped ? "Grant permissions instead" : "Skip for now — use limited access"}
      </button>
      {skipped && (
        <p className="mt-3 text-[12px] text-muted-foreground leading-relaxed text-center">
          You can grant these any time in Settings → Permissions. Until then, a feature that
          needs a missing permission shows an honest "no access" state — ChatZ never invents
          data to fill the gap.
        </p>
      )}

      <p className="mt-4 text-[11px] text-muted-foreground text-center">
        {isNative
          ? "Buttons open your phone's Settings. Look for ChatZ in each screen."
          : "Run on a real Android device to request actual permissions."}
      </p>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2.5 rounded-2xl text-[13px] font-medium shadow-lg max-w-xs text-center animate-in fade-in slide-in-from-bottom duration-200">
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block bg-surface rounded-2xl px-4 py-3 border border-border">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}
