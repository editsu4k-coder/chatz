import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  useProfile,
  writeProfile,
  ageFromDob,
  AVATAR_COLORS,
  DEFAULT_PRIVACY,
  type Profile,
  type Privacy,
  type Socials,
} from "@/lib/profile-store";
import {
  HandleTakenError,
  changeHandle,
  isOfflineError,
  updateProfile,
  type ProfilePatch,
} from "@/lib/profile-repo";
import { AvatarPicker } from "@/components/AvatarPicker";
import { signOutEverywhere } from "@/lib/session";
import { Avatar } from "@/components/Avatar";
import { ChatZMark } from "@/components/Logo";
import { SocialIcon, SOCIAL_META, SOCIAL_ORDER, type SocialKey } from "@/components/Socials";
import { useHandleAvailability } from "@/lib/use-handle-availability";
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
import {
  ChevronRight,
  X,
  Palette,
  Bell,
  Shield,
  HelpCircle,
  Ban,
  GraduationCap,
  Cake,
  Mail,
  Info,
  Loader2,
  Check,
  HelpCircle as HelpIcon,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "Profile · ChatZ" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const profile = useProfile();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [notifSheet, setNotifSheet] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const privacy: Privacy = { ...DEFAULT_PRIVACY, ...(profile?.privacy ?? {}) };
  const togglePrivacy = (k: keyof Privacy) => {
    if (!profile) return;
    writeProfile({ ...profile, privacy: { ...privacy, [k]: !privacy[k] } });
  };

  const logout = async () => {
    setLogoutLoading(true);
    try {
      // Signs out of both Firebase instances and drops the cached profile.
      await signOutEverywhere();
    } catch (err) {
      console.warn("Sign-out failed:", err);
    }
    setLogoutLoading(false);
    navigate({ to: "/" });
  };

  const socials = profile?.socials ?? {};
  const hasAnySocial = SOCIAL_ORDER.some((k) => (socials as Socials)[k]);
  const fullName =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.name;

  return (
    <>
      <header className="sticky top-0 z-20 glass-blur safe-top px-5 pt-2 pb-3 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight">Profile</h1>
        <div className="flex items-center gap-2">
          <span className="rounded-[10px] overflow-hidden bg-foreground text-background flex">
            <ChatZMark size={26} glyphOnly bg="transparent" fg="currentColor" />
          </span>
          <span className="text-[14px] font-semibold tracking-tight">
            Chat<span className="font-bold">Z</span>
          </span>
        </div>
      </header>

      <div className="px-4 pt-2 pb-6 space-y-5">
        <section className="rounded-3xl bg-surface border border-border p-5">
          <div className="flex items-center gap-4">
            {profile && (
              <Avatar name={profile.name} color={profile.color} avatarId={profile.avatarId} size="xl" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold tracking-tight truncate">
                {fullName ?? "You"}
              </div>
              <div className="text-[13px] text-muted-foreground truncate">
                @{profile?.handle ?? "you"}
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                Daily goal · {profile?.goalHours ?? 4}h
              </div>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-primary text-[13px] font-medium"
            >
              Edit
            </button>
          </div>

          {profile?.bio && (
            <p className="mt-4 text-[14px] leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
          )}

          {(profile?.age || profile?.education || profile?.email) && (
            <ul className="mt-4 space-y-1.5 text-[13px] text-muted-foreground">
              {profile?.age && (
                <li className="flex items-center gap-2">
                  <Cake size={14} /> {profile.age} years old
                </li>
              )}
              {profile?.education && (
                <li className="flex items-center gap-2">
                  <GraduationCap size={14} /> {profile.education}
                </li>
              )}
              {profile?.email && (
                <li className="flex items-center gap-2">
                  <Mail size={14} /> {profile.email}
                </li>
              )}
            </ul>
          )}

          {hasAnySocial && (
            <div className="mt-4 flex flex-wrap gap-2">
              {SOCIAL_ORDER.map((k) => {
                const v = (socials as Socials)[k];
                if (!v) return null;
                const meta = SOCIAL_META[k];
                return (
                  <a
                    key={k}
                    href={meta.toUrl(v)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={meta.label}
                    className="w-10 h-10 rounded-full grid place-items-center text-white active:scale-95 transition shadow-sm"
                    style={{ background: meta.brand }}
                  >
                    <SocialIcon k={k} size={18} />
                  </a>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-surface border border-border overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Privacy · what friends see
          </div>
          <Row
            label="Screen time"
            sublabel="Your daily total"
            on={privacy.showScreenTime}
            onChange={() => togglePrivacy("showScreenTime")}
          />
          <Row
            label="Top app"
            sublabel="Most-used app on your cards"
            on={privacy.showTopApp}
            onChange={() => togglePrivacy("showTopApp")}
          />
          <Row
            label="Data usage"
            sublabel="Wi-Fi + cellular totals"
            on={privacy.showData}
            onChange={() => togglePrivacy("showData")}
          />
          <Row
            label="Wi-Fi info"
            sublabel="Wi-Fi network breakdown"
            on={privacy.showWifi}
            onChange={() => togglePrivacy("showWifi")}
          />
          <Row
            label="Battery"
            sublabel="Current battery percentage"
            on={privacy.showBattery}
            onChange={() => togglePrivacy("showBattery")}
          />
          <Row
            label="App launches"
            sublabel="How often you open apps"
            on={privacy.showLaunches}
            onChange={() => togglePrivacy("showLaunches")}
          />
          <Row
            label="Notifications"
            sublabel="Notification count today"
            on={privacy.showNotifications}
            onChange={() => togglePrivacy("showNotifications")}
          />
          <Row
            label="Device info"
            sublabel="Phone model and Android version"
            on={privacy.showDeviceInfo}
            onChange={() => togglePrivacy("showDeviceInfo")}
            last
          />
        </section>

        <section className="rounded-3xl bg-surface border border-border overflow-hidden">
          <div className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Discoverability
          </div>
          <Row
            label="Appear in search"
            sublabel="Let people find you by name or @handle"
            on={privacy.appearInSearch}
            onChange={() => togglePrivacy("appearInSearch")}
            last
          />
        </section>

        <section className="rounded-3xl bg-surface border border-border overflow-hidden">
          <LinkRow
            label="Appearance & theme"
            icon={<Palette size={18} />}
            to="/app/settings/theme"
          />
          <LinkRow
            label="Notifications"
            icon={<Bell size={18} />}
            onClick={() => setNotifSheet(true)}
          />
          <LinkRow
            label="Permissions"
            icon={<ShieldCheck size={18} />}
            to="/app/settings/permissions"
          />
          <LinkRow label="Blocked accounts" icon={<Ban size={18} />} to="/app/settings/blocked" />
          <LinkRow label="Privacy policy" icon={<Shield size={18} />} to="/app/settings/privacy" />
          <LinkRow
            label="Help & support"
            icon={<HelpCircle size={18} />}
            to="/app/settings/help"
          />
          <LinkRow label="About ChatZ" icon={<Info size={18} />} to="/app/settings/about" last />
        </section>

        <button
          onClick={logout}
          disabled={logoutLoading}
          className="w-full h-12 rounded-2xl bg-surface border border-border text-destructive font-medium text-[15px] active:scale-[0.99] transition disabled:opacity-60"
        >
          {logoutLoading ? "Signing out…" : "Sign out"}
        </button>

        <AppVersionFooter />
      </div>

      {editing && profile && (
        <EditProfileSheet profile={profile} onClose={() => setEditing(false)} />
      )}
      {notifSheet && (
        <SimpleSheet title="Notifications" onClose={() => setNotifSheet(false)}>
          <div className="space-y-1">
            <ToggleRow label="Friend posts" defaultOn />
            <ToggleRow label="Reactions on your stats" defaultOn />
            <ToggleRow label="Comments" defaultOn />
            <ToggleRow label="Direct messages" defaultOn />
            <ToggleRow label="Friend requests" defaultOn />
            <ToggleRow label="Group invites" defaultOn />
            <ToggleRow label="Mentions" defaultOn />
            <ToggleRow label="Daily summary" />
            <ToggleRow label="Marketing emails" />
          </div>
        </SimpleSheet>
      )}
    </>
  );
}

function Row({
  label,
  sublabel,
  on,
  onChange,
  last,
}: {
  label: string;
  sublabel?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${last ? "" : "border-b border-border"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium">{label}</div>
        {sublabel && <div className="text-[12px] text-muted-foreground">{sublabel}</div>}
      </div>
      <Switch on={on} onChange={onChange} />
    </div>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`w-[51px] h-[31px] rounded-full p-0.5 transition-colors ${on ? "bg-success" : "bg-border"}`}
    >
      <span
        className={`block w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="px-1 py-2 flex items-center gap-3">
      <span className="flex-1 text-[15px]">{label}</span>
      <Switch on={on} onChange={setOn} />
    </div>
  );
}

function AppVersionFooter() {
  const [label, setLabel] = useState("ChatZ");
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      NativeApp.getInfo()
        .then((i) => setLabel(`ChatZ · v${i.version}`))
        .catch(() => {});
    }
  }, []);
  return <p className="text-center text-xs text-muted-foreground pt-2">{label}</p>;
}

function LinkRow({
  label,
  icon,
  onClick,
  to,
  last,
}: {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  to?: string;
  last?: boolean;
}) {
  const inner = (
    <>
      {icon && (
        <span className="w-8 h-8 rounded-full bg-secondary grid place-items-center text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="flex-1 text-[15px]">{label}</span>
      <ChevronRight size={16} className="text-muted-foreground" />
    </>
  );
  const cls = `w-full px-4 py-3.5 flex items-center gap-3 text-left ${last ? "" : "border-b border-border"} active:bg-secondary`;
  if (to)
    return (
      <Link to={to as "/app/settings/theme"} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function SimpleSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/30"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-background rounded-t-3xl p-6 safe-bottom animate-in slide-in-from-bottom duration-200"
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-full bg-secondary"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditProfileSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [firstName, setFirstName] = useState(profile.firstName ?? profile.name.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(
    profile.lastName ?? profile.name.split(" ").slice(1).join(" ") ?? "",
  );
  const [handle, setHandle] = useState(profile.handle);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [dob, setDob] = useState<string>(profile.dob ?? "");
  const [education, setEducation] = useState(profile.education ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [color, setColor] = useState(profile.color);
  const [avatarId, setAvatarId] = useState(profile.avatarId);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [goal, setGoal] = useState(profile.goalHours);
  const [socials, setSocials] = useState<Socials>(profile.socials ?? {});
  const [openHint, setOpenHint] = useState<SocialKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAvailability = useHandleAvailability(handle, profile.uid, profile.handle);
  const nameCount = graphemeLength(cleanName(`${firstName} ${lastName}`));

  const save = async () => {
    if (saving) return;
    const uid = profile.uid;
    if (!uid) {
      setError("You're not signed in.");
      return;
    }

    // Name rules live in one place and apply here exactly as in onboarding.
    const first = cleanName(firstName);
    const last = cleanName(lastName);
    const fullName = [first, last].filter(Boolean).join(" ") || "You";
    const nameIssue = nameProblem(fullName);
    if (nameIssue) {
      setError(nameIssue);
      return;
    }
    const cleanB = cleanBio(bio);

    setSaving(true);
    setError(null);
    try {
      // The handle is a reserved resource: it changes through its own transaction.
      const nextHandle =
        handle.trim() && handle.trim() !== profile.handle
          ? await changeHandle(uid, handle)
          : profile.handle;

      // Only send what actually changed — no blanket rewrite of the profile.
      const patch: ProfilePatch = {};
      if (fullName !== profile.name) patch.name = fullName;
      if (first !== (profile.firstName ?? "")) patch.firstName = first;
      if (last !== (profile.lastName ?? "")) patch.lastName = last;
      if (cleanB !== (profile.bio ?? "")) patch.bio = cleanB;
      if (dob !== (profile.dob ?? "")) patch.dob = dob;
      if (education.trim() !== (profile.education ?? "")) patch.education = education.trim();
      if (email.trim() !== (profile.email ?? "")) patch.email = email.trim();
      if (Object.keys(patch).length > 0) await updateProfile(uid, patch);

      // Local cache last, so it always reflects what Firestore accepted. The app
      // shell mirrors colour, goal and social links from this write.
      writeProfile({
        ...profile,
        name: fullName,
        firstName: first || undefined,
        lastName: last || undefined,
        handle: nextHandle,
        bio: cleanB || undefined,
        dob: dob || undefined,
        age: ageFromDob(dob),
        education: education.trim() || undefined,
        email: email.trim() || undefined,
        color,
        avatarId,
        goalHours: goal,
        socials,
      });
      onClose();
    } catch (err) {
      if (err instanceof HandleTakenError) {
        setError(err.message);
      } else if (isOfflineError(err)) {
        setError("No connection. Your changes weren't saved — try again.");
      } else {
        console.warn("Profile update failed", err);
        setError("Couldn't save your changes. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SimpleSheet title="Edit profile" onClose={onClose}>
      <div className="flex flex-col items-center">
        <Avatar
          name={`${firstName} ${lastName}`.trim() || "You"}
          color={color}
          avatarId={avatarId}
          size="2xl"
        />
        <button
          type="button"
          onClick={() => setPickingAvatar((v) => !v)}
          className="mt-3 h-9 px-4 rounded-full bg-secondary text-[13px] font-medium active:scale-95"
        >
          {pickingAvatar ? "Done" : "Change avatar"}
        </button>
      </div>

      {pickingAvatar && (
        <div className="mt-4">
          <AvatarPicker value={avatarId} onSelect={setAvatarId} />
        </div>
      )}

      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
          Avatar color
        </div>
        <p className="text-[12px] text-muted-foreground mb-2">
          Frames your avatar on Home, in friends' lists and on your profile.
        </p>
        <div className="grid grid-cols-6 gap-3">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`aspect-square rounded-full transition-transform ${color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110" : ""}`}
              style={{ background: c }}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
      </div>

      {/* Personal details */}
      <SectionLabel>About you</SectionLabel>
      <div className="space-y-3">
        <div>
          <div className="grid grid-cols-2 gap-3">
            <FieldBox label="First name">
              <input
                value={firstName}
                onChange={(e) => setFirstName(stripUnsafe(e.target.value))}
                className="w-full mt-1 bg-transparent outline-none text-[16px]"
                placeholder="Alex"
              />
            </FieldBox>
            <FieldBox label="Last name">
              <input
                value={lastName}
                onChange={(e) => setLastName(stripUnsafe(e.target.value))}
                className="w-full mt-1 bg-transparent outline-none text-[16px]"
                placeholder="Rivera"
              />
            </FieldBox>
          </div>
          <div
            className={`text-right text-[11px] tabular-nums mt-1 ${
              nameCount > NAME_MAX ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {nameCount}/{NAME_MAX}
          </div>
        </div>

        <FieldBox label="Handle">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-[16px]">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase())}
              className="flex-1 bg-transparent outline-none text-[16px]"
            />
            {handleAvailability === "checking" && (
              <Loader2 size={15} className="animate-spin text-muted-foreground" />
            )}
            {handleAvailability === "available" && <Check size={15} className="text-success" />}
            {handleAvailability === "taken" && <X size={15} className="text-destructive" />}
          </div>
          {handleAvailability === "taken" && (
            <div className="text-[12px] text-destructive mt-1">
              This handle is already taken
            </div>
          )}
        </FieldBox>

        <FieldBox label="Bio">
          <textarea
            value={bio}
            onChange={(e) =>
              setBio(clampGraphemes(stripUnsafe(e.target.value, { multiline: true }), BIO_MAX))
            }
            rows={3}
            placeholder="A short note about you"
            className="w-full mt-1 bg-transparent outline-none text-[15px] resize-none"
          />
          <div className="text-right text-[11px] text-muted-foreground tabular-nums">
            {graphemeLength(bio)}/{BIO_MAX}
          </div>
        </FieldBox>

        <div className="grid grid-cols-2 gap-3">
          <FieldBox label="Date of birth">
            <input
              type="date"
              value={dob}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDob(e.target.value)}
              className="w-full mt-1 bg-transparent outline-none text-[16px]"
            />
            {dob && ageFromDob(dob) !== undefined && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {ageFromDob(dob)} years old
              </div>
            )}
          </FieldBox>
          <FieldBox label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 bg-transparent outline-none text-[16px]"
              placeholder="you@…"
            />
          </FieldBox>
        </div>

        <FieldBox label="Education">
          <input
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            className="w-full mt-1 bg-transparent outline-none text-[16px]"
            placeholder="e.g. BSc Computer Science, NYU"
          />
        </FieldBox>

        <FieldBox label="Daily goal">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Soft target</span>
            <span className="text-[13px] font-medium tabular-nums">{goal}h</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="w-full mt-2 accent-[var(--color-primary)]"
          />
        </FieldBox>
      </div>

      {/* Social links */}
      <SectionLabel>
        <span className="flex items-center gap-1">
          Social links <Info size={12} className="text-muted-foreground" />
        </span>
      </SectionLabel>
      <p className="text-[12px] text-muted-foreground mb-3">
        Tap the <HelpIcon size={11} className="inline -mt-0.5" /> next to any platform for a quick
        guide on finding your link.
      </p>
      <div className="space-y-2">
        {SOCIAL_ORDER.map((k) => {
          const meta = SOCIAL_META[k];
          return (
            <div key={k} className="bg-secondary rounded-2xl px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full grid place-items-center text-white flex-shrink-0"
                  style={{ background: meta.brand }}
                >
                  <SocialIcon k={k} size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] uppercase tracking-wider text-muted-foreground font-medium">
                      {meta.label}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenHint((h) => (h === k ? null : k))}
                      className="text-muted-foreground p-0.5 -mr-1"
                      aria-label={`How to find your ${meta.label} link`}
                    >
                      <HelpIcon size={14} />
                    </button>
                  </div>
                  <input
                    value={(socials as Socials)[k] ?? ""}
                    onChange={(e) =>
                      setSocials((s) => ({ ...s, [k]: e.target.value || undefined }))
                    }
                    placeholder={meta.placeholder}
                    className="w-full bg-transparent outline-none text-[15px] mt-0.5"
                  />
                </div>
              </div>
              {openHint === k && (
                <div className="mt-2 ml-11 text-[12px] text-muted-foreground leading-relaxed bg-background/60 rounded-xl p-2.5">
                  {meta.hint}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-destructive/10 text-destructive text-[13px] px-4 py-3 leading-relaxed">
          {error}
        </div>
      )}

      <div className="mt-6 flex gap-2 sticky bottom-0 bg-background pt-2">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 h-12 rounded-full bg-secondary font-medium disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-medium active:scale-[0.99] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </SimpleSheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
      {children}
    </div>
  );
}

function FieldBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block bg-secondary rounded-2xl px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </div>
      {children}
    </label>
  );
}
