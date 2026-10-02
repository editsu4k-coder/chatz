import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  LifeBuoy,
  Ban,
  Search,
  Mail,
  Send,
  Shield,
  Plus,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  BarChart3,
  Bell,
  BatteryCharging,
  Download,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ChatZMark } from "@/components/Logo";
import { RestrictedSettingsNote } from "@/components/RestrictedSettingsNote";
import { relTime } from "@/components/stat-ui";
import { useProfile } from "@/lib/profile-store";
import { listBlocked, unblockUser, type BlockedUser } from "@/lib/blocks-repo";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  REQUIRED_PERMS,
  checkAllPerms,
  openPermSettings,
  allPermsGranted,
  isNativeApp,
  type PermKey,
  type PermState,
} from "@/lib/app-permissions";
import { checkForUpdates, clearUpdateCache, type UpdateInfo } from "@/lib/update-repo";

export const Route = createFileRoute("/app/settings/$section")({
  head: ({ params }) => ({ meta: [{ title: `${cap(params.section)} · ChatZ` }] }),
  component: SettingsSection,
});

function cap(s: string) {
  return s.slice(0, 1).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function SectionMark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="bg-foreground text-background flex shrink-0 overflow-hidden"
      style={{ borderRadius: Math.round(size * 0.28) }}
    >
      <ChatZMark size={size} glyphOnly bg="transparent" fg="currentColor" />
    </span>
  );
}

function SettingsSection() {
  const { section } = Route.useParams();
  const navigate = useNavigate();

  const title =
    section === "privacy"
      ? "Privacy Policy"
      : section === "help"
        ? "Help & Support"
        : section === "permissions"
          ? "Permissions"
          : section === "about"
            ? "About ChatZ"
            : section === "blocked"
              ? "Blocked Accounts"
              : cap(section);

  return (
    <>
      <header className="sticky top-0 z-20 glass-blur safe-top px-3 pt-2 pb-2 flex items-center gap-2 border-b border-border">
        <button
          onClick={() => navigate({ to: "/app/profile" })}
          className="text-primary p-2 -ml-1 flex items-center"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="flex items-center gap-2 min-w-0">
          <SectionMark />
          <h1 className="text-[17px] font-semibold tracking-tight truncate">{title}</h1>
        </span>
      </header>
      <div className="px-4 pt-5 pb-10">
        {section === "privacy" && <PrivacyPolicy />}
        {section === "help" && <Help />}
        {section === "permissions" && <Permissions />}
        {section === "about" && <About />}
        {section === "blocked" && <Blocked />}
        {!["privacy", "help", "permissions", "about", "blocked"].includes(section) && (
          <p className="text-muted-foreground text-sm">Unknown section.</p>
        )}
      </div>
    </>
  );
}

/* -------------------- Permissions -------------------- */
const PERM_ICON: Record<PermKey, React.ReactNode> = {
  usage: <BarChart3 size={18} />,
  notifs: <Bell size={18} />,
  background: <BatteryCharging size={18} />,
};

function Permissions() {
  const [state, setState] = useState<PermState | null>(null);
  const [busy, setBusy] = useState<PermKey | null>(null);
  const native = isNativeApp();

  const refresh = useCallback(() => {
    checkAllPerms()
      .then(setState)
      .catch(() => {});
  }, []);

  // Live status the whole time the screen is open: re-checked on mount and every
  // time the user comes back from the Android settings page they were sent to.
  useEffect(() => {
    refresh();
    if (!native) return;
    let alive = true;
    const sub = NativeApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive && alive) refresh();
    });
    return () => {
      alive = false;
      sub.then((h) => h.remove()).catch(() => {});
    };
  }, [native, refresh]);

  const open = async (id: PermKey) => {
    setBusy(id);
    try {
      await openPermSettings(id);
      // A granted runtime dialog (notifications) resolves without a pause/resume
      // cycle, so the appStateChange listener alone would leave the row stale.
      refresh();
    } catch {
      // The row's Android note still tells the user where to go manually.
    }
    // Settings opens over the app; the appStateChange listener re-checks on return.
    window.setTimeout(() => setBusy(null), 1200);
  };

  const grantedCount = state ? REQUIRED_PERMS.filter((p) => state[p.id]).length : 0;
  const allOn = state !== null && allPermsGranted(state);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${
                allOn ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
              }`}
            >
              {state === null ? (
                <Loader2 size={18} className="animate-spin" />
              ) : allOn ? (
                <Check size={18} />
              ) : (
                <Shield size={18} />
              )}
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">
                {state === null ? "Checking…" : `${grantedCount} of 3 active`}
              </div>
              <div className="text-[12px] text-muted-foreground leading-snug">
                {allOn
                  ? "ChatZ has every permission it needs."
                  : "ChatZ needs all three to work correctly."}
              </div>
            </div>
          </div>
          <button
            onClick={refresh}
            className="h-9 px-3 rounded-full bg-secondary text-[13px] font-medium flex items-center gap-1.5 active:scale-95 shrink-0"
          >
            <RefreshCw size={13} /> Re-check
          </button>
        </div>
      </div>

      <ul className="space-y-2">
        {REQUIRED_PERMS.map((p) => {
          const on = state ? state[p.id] : false;
          const opening = busy === p.id;
          return (
            <li key={p.id}>
              <button
                onClick={() => open(p.id)}
                className={`w-full bg-surface border rounded-2xl p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-all ${
                  on ? "border-success/40" : "border-border"
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-full grid place-items-center shrink-0 ${
                    on ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {opening ? <Loader2 size={18} className="animate-spin" /> : PERM_ICON[p.id]}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium">{p.label}</span>
                  <span className="block text-[12px] text-muted-foreground leading-snug mt-0.5">
                    {on ? "Granted" : p.howTo}
                  </span>
                </span>
                {on ? (
                  <span className="text-[12px] font-semibold text-success bg-success/15 rounded-full px-2.5 py-1 flex items-center gap-1 shrink-0">
                    <Check size={12} /> Granted
                  </span>
                ) : (
                  <span className="text-[12px] font-semibold text-primary-foreground bg-primary rounded-full px-3 py-1.5 flex items-center gap-1 shrink-0">
                    <ExternalLink size={12} /> Grant
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {state && !state.usage && <RestrictedSettingsNote />}

      <p className="px-1 text-[12px] text-muted-foreground leading-relaxed">
        Each row opens the exact Android settings screen for that permission. Status is re-checked
        automatically when you come back — if you revoke a permission in Android Settings, ChatZ
        notices and restricts the affected features instead of showing stale data.
        {!native && " In this browser preview, permission checks only run in the installed Android app."}
      </p>
    </div>
  );
}

/* -------------------- Privacy Policy -------------------- */
function PrivacyPolicy() {
  return (
    <article className="prose-like space-y-5 text-[15px] leading-relaxed">
      <div className="rounded-2xl bg-surface border border-border p-4 flex items-start gap-3">
        <Shield size={18} className="text-primary mt-0.5" />
        <div className="text-[13px] text-muted-foreground">
          Last updated <span className="text-foreground font-medium">October 1, 2026</span>. This
          policy describes what the <span className="text-foreground font-medium">current version</span>{" "}
          of ChatZ actually does — nothing more.
        </div>
      </div>

      <Section title="1. What ChatZ is">
        <p>
          ChatZ is a private, friend-only screen-time app. You sign in with Google (through Firebase
          Authentication), and your data is stored in Google Firebase (Cloud Firestore). There is no
          public feed, no follower system, no advertising, and no third-party analytics SDKs.
        </p>
      </Section>

      <Section title="2. What we collect">
        <p>
          <b className="text-foreground">Account & profile.</b> Your Google account email and user
          ID, the display name and unique @handle you choose, your avatar selection, an optional
          bio, date of birth and education, and your daily screen-time goal. The bio, date of birth
          and education are stored privately — friends never see them. ChatZ does not use your
          Google profile photo; it ships its own avatar set.
        </p>
        <p>
          <b className="text-foreground">Device usage</b> (only while you grant Usage access). ChatZ
          reads Android's usage events on your device and uploads a summary of today: your screen
          time (total and per app), how many apps you opened, how many notifications appeared (the
          count only — never their content), device model and Android version, battery level and
          charging state, and how much Wi-Fi / mobile data was used today. It also sees whether
          you're currently on Wi-Fi or mobile data.
        </p>
        <p>
          <b className="text-foreground">What is not collected.</b> Your location, contacts, photos
          or files, camera or microphone, the contents of your notifications or other apps'
          messages, browser history, keystrokes, or advertising identifiers. ChatZ does not read
          your Wi-Fi network name — that would require location permission, which ChatZ never asks
          for.
        </p>
        <p>
          <b className="text-foreground">Social data.</b> Friend requests and connections, messages
          you send, reactions and comments on stat cards, in-app notifications, conversation read
          state, your daily-use streak (the count of consecutive days you've opened ChatZ, shown to
          friends), and presence (online / last seen) so friends can tell when you're around. If you
          block someone the block is stored so the backend can enforce it — blocked people can't
          read your profile or stats, message you, or see your presence. If you report someone, the
          report is stored privately: the reported person can never read it or see who reported
          them.
        </p>
      </Section>

      <Section title="3. How sharing works">
        <p>
          Your device stats are visible only to friends you've accepted — enforced by server-side
          security rules, not just by the app's interface. In Profile → Privacy you switch
          individual categories on or off. When a category is off, ChatZ stops uploading it: the
          stored copy is rewritten immediately without that data, so a friend can't read the
          disabled category — not even an older value — and the app doesn't show what isn't shared.
          A disabled category never falls back to zero or a placeholder; it simply isn't there.
        </p>
        <p>
          Home shows your current mode. <b className="text-foreground">Active</b> shares your stats
          according to your individual category switches. <b className="text-foreground">Silent</b>{" "}
          stops sharing entirely: friends immediately stop receiving your numbers and see “Stats
          sharing is paused” instead, and you appear offline until you switch back. Silent never
          changes your category settings — returning to Active resumes exactly what you had
          switched on.
        </p>
      </Section>

      <Section title="4. How long data is kept">
        <p>
          <b className="text-foreground">Device snapshot.</b> Your device stats live in a single
          document per account, and each successful sync <b className="text-foreground">replaces</b>{" "}
          the previous one — there is no archive of past snapshots. Sync runs about every 15
          minutes when Android allows background work, and whenever you open the app; because
          Android may defer background jobs, the stored copy can lag behind your phone.
        </p>
        <p>
          <b className="text-foreground">Temporary activity.</b> Reactions, comments and
          notifications are stamped to expire 24 hours after they're created, and the app stops
          showing them at that point. The actual deletion is done by a scheduled server cleanup and
          can lag behind the expiry time, so treat expiry as “no longer shown in the app” rather
          than “removed at the exact minute”. Daily stat cards, messages, friend connections and
          presence have no automatic expiry — they stay on the server so the features keep working.
        </p>
        <p>
          <b className="text-foreground">Deletion.</b> Signing out removes your session from this
          device but keeps your account. There is no in-app account-deletion button yet — email
          ChatZ Support to have your account and data deleted. Turning a category off immediately
          rewrites your stored snapshot without that category — the old values are gone as soon as
          the app applies the change, not at the next background sync. While Silent mode is on, your
          stored snapshot is replaced with a masked copy, and turning Silent off restores a fresh
          snapshot built from your current settings.
        </p>
      </Section>

      <Section title="5. Your controls and rights">
        <p>
          You can revoke any Android permission at any time in Android Settings (ChatZ → Settings →
          Permissions takes you straight to each one) and ChatZ stops using it immediately. In the
          app you control privacy categories, the Active / Silent mode switch, blocking, and your
          profile content. For access,
          correction or deletion requests — including GDPR, UK-GDPR, CCPA and LGPD rights — contact
          ChatZ Support at{" "}
          <a className="text-primary" href="mailto:chatz.org@gmail.com">
            chatz.org@gmail.com
          </a>
          .
        </p>
      </Section>

      <Section title="6. Children">
        <p>
          ChatZ is not for children under 13 (or under 16 in the EU). If you believe a child under
          that age is using ChatZ, contact ChatZ Support and the account will be removed.
        </p>
      </Section>

      <Section title="7. Android permissions ChatZ asks for">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <b className="text-foreground">Usage access</b> (special access) — read screen time and
            app usage. Revocable in Settings → Special app access → Usage access.
          </li>
          <li>
            <b className="text-foreground">Notifications</b> — friend requests, reactions, comments
            and message alerts. Revocable in Settings → Apps → ChatZ → Notifications.
          </li>
          <li>
            <b className="text-foreground">Unrestricted background activity</b> (battery
            optimization exemption) — so syncing isn't frozen. Revocable in Settings → Battery.
          </li>
          <li>
            <b className="text-foreground">Internet, network & Wi-Fi state</b> — connecting to
            Firebase and telling Wi-Fi from mobile data. Granted at install.
          </li>
        </ul>
      </Section>

      <Section title="8. Contact">
        <Contacts />
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold tracking-tight mb-1.5">{title}</h2>
      <div className="text-[14px] text-muted-foreground space-y-2">{children}</div>
    </section>
  );
}

/* -------------------- Contacts (used by Privacy, Help, About) -------------------- */
function Contacts() {
  return (
    <ul className="rounded-2xl bg-surface border border-border overflow-hidden not-prose">
      <ContactRow
        icon={<LifeBuoy size={17} />}
        label="ChatZ Support"
        sub="Product help, privacy requests, account deletion · chatz.org@gmail.com"
        href="mailto:chatz.org@gmail.com"
      />
      <ContactRow
        icon={<Mail size={17} />}
        label="Developer / Business Contact"
        sub="Partnerships and everything else · Mirmajid@proton.me"
        href="mailto:Mirmajid@proton.me"
      />
      <ContactRow
        icon={<Send size={17} />}
        label="Telegram"
        sub="@Mirmajid01 — quickest way to reach the developer"
        href="https://t.me/Mirmajid01"
        last
      />
    </ul>
  );
}

/* -------------------- Help & Support -------------------- */
function Help() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const faqs = [
    {
      id: "start",
      q: "How do I sign in?",
      a: "ChatZ uses Google Sign-In only. Tap Continue with Google on the welcome screen — the account chooser opens. If nothing happens, check that you're online and that Google Play services is up to date. The first sign-in takes you through profile setup.",
    },
    {
      id: "profile",
      q: "How do I set up or change my profile?",
      a: "First sign-in walks you through your name, a unique @handle, an avatar and a daily goal. To change anything later, open the Me tab — name, avatar, bio and socials live there. Friends find you by your @handle.",
    },
    {
      id: "perms",
      q: "Which permissions does ChatZ need and why?",
      a: "Three: Screen-time access (reads your real usage so stats work), Notifications (friend requests, reactions, comments, messages) and Background activity (stops Android freezing the app so stats keep syncing). Setup asks for all three but never locks you out — you can skip and use the app with limited access, then grant any of them later here. A feature that needs a missing permission shows an honest \u201Cno access\u201D state instead of fake data, and each row below shows its live status from Android.",
    },
    {
      id: "manage-perms",
      q: "How do I manage or fix permissions later?",
      a: "Me tab → Settings → Permissions. Each of the three rows shows live Granted / Not granted status and opens the exact Android settings page for that permission. When you come back, the status re-checks automatically. If a permission is revoked, ChatZ restricts the affected feature instead of showing stale data.",
    },
    {
      id: "f1",
      q: "How do I add a friend?",
      a: "Friends tab → Find people → search their @handle or name → tap Add. They accept from their Friends tab, and then you can see each other's shared screen-time stats. Requests also appear as in-app notifications.",
    },
    {
      id: "f2",
      q: "What do my friends see about me?",
      a: "Only what you allow in Profile → Privacy, and only today's summary — never your bio, date of birth or education. A category you switch off isn't shown to friends at all (no “0”, no old value — it's simply absent), and it's removed from your stored snapshot right away. In Silent mode, friends see “Stats sharing is paused” instead of any numbers.",
    },
    {
      id: "modes",
      q: "What's the difference between Active and Silent mode?",
      a: "The mode control is on your Home dashboard. Active (the default) shares today's stats with your friends according to your individual category switches — Active never overrides a category you've switched off. Silent immediately stops all stat sharing: friends see a “Stats sharing is paused” notice instead of your numbers, and you appear offline while Silent is on. Switching back to Active restores exactly what you had switched on — Silent never changes your category settings.",
    },
    {
      id: "block",
      q: "How do blocking and unfriending work?",
      a: "Open someone's profile (or their card in the Friends tab) and use the menu in the top-right. Unfriend removes the friendship for both of you right away; they get a notification. Block additionally stops them from messaging you, seeing your profile, stats or online status, or sending you friend requests — any friendship and pending requests are removed. Blocking doesn't report them. Unblocking lets them see your shared stats and send a new request again, but it does not restore the friendship automatically — they'd need to send a new friend request.",
    },
    {
      id: "report",
      q: "How do I report someone?",
      a: "Open their profile → menu (top-right) → Report, pick a reason and optionally add details. Reports are private — the person is never told, and they can never read the report or see who sent it. Reporting doesn't block or unfriend anyone; if you also want to stop them, block them separately.",
    },
    {
      id: "f3",
      q: "Why are my stats missing or out of date?",
      a: "Two usual causes: Usage access was revoked (ChatZ shows a permission screen — re-grant it from there), or Android deferred the background sync. Opening the app refreshes immediately; for reliable background syncing, keep ChatZ exempt from battery optimization (Settings → Permissions → Background activity).",
    },
    {
      id: "f4",
      q: "Why didn't I get a notification?",
      a: "Check in-app notification preferences in your profile, and make sure Android notifications for ChatZ are on — Me → Settings → Permissions shows the live state. Note that background alerts depend on Google Play services delivering them; ChatZ also shows unread dots in the app.",
    },
    {
      id: "f5",
      q: "How do reactions and comments work?",
      a: "Open a friend from the Friends tab and react or comment on their screen-time card. They get an in-app notification, and you can reply in threads on the card. The card owner can reply too.",
    },
    {
      id: "streak",
      q: "What is the 🔥 streak number?",
      a: "It counts the consecutive days you've opened ChatZ — one more each day you come back, reset to 1 after a missed day. Your streak sits on your Home card and friends can see it on your card too. It's just a habit badge: no data behind it beyond the day counter itself.",
    },
    {
      id: "f6",
      q: "How do messages work?",
      a: "Tap the message icon on a friend's card in the Friends tab. Messages are delivered through your account and a dot on the Friends tab marks unread conversations.",
    },
    {
      id: "f7",
      q: "What does “last seen” mean?",
      a: "It shows when a friend was last active in ChatZ — updated while the app is open and marked away shortly after it closes. While Silent mode is on you appear offline: presence stops updating and friends see you as away, just like when the app is closed. Switching back to Active resumes it.",
    },
    {
      id: "f8",
      q: "How do I sign out or delete my account?",
      a: "Sign out from the Me tab — that removes your session from this device. There's no in-app delete button yet; email ChatZ Support to delete your account and data.",
    },
  ];
  const filtered = faqs.filter((f) => (f.q + f.a).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface border border-border p-4 flex items-start gap-3">
        <LifeBuoy size={18} className="text-primary mt-0.5" />
        <div className="text-[13px] text-muted-foreground">
          ChatZ Support is{" "}
          <a className="text-primary" href="mailto:chatz.org@gmail.com">
            chatz.org@gmail.com
          </a>{" "}
          — we aim to reply within <b className="text-foreground">24 hours</b> on weekdays.
        </div>
      </div>

      <div className="h-11 rounded-2xl bg-secondary px-3 flex items-center gap-2">
        <Search size={16} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help…"
          className="flex-1 bg-transparent outline-none text-[15px]"
        />
      </div>

      <section>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 px-1">
          Frequently asked
        </div>
        <ul className="rounded-2xl bg-surface border border-border overflow-hidden">
          {filtered.map((f, i) => (
            <li key={f.id} className={i === filtered.length - 1 ? "" : "border-b border-border"}>
              <button
                onClick={() => setOpen((o) => (o === f.id ? null : f.id))}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left active:bg-secondary"
              >
                <span className="text-[15px] font-medium">{f.q}</span>
                <Plus
                  size={16}
                  className={`text-muted-foreground transition-transform ${open === f.id ? "rotate-45" : ""}`}
                />
              </button>
              {open === f.id && (
                <p className="px-4 pb-4 -mt-1 text-[14px] text-muted-foreground leading-relaxed">
                  {f.a}
                </p>
              )}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matches for "{q}"
            </li>
          )}
        </ul>
      </section>

      <section>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 px-1">
          Get in touch
        </div>
        <Contacts />
      </section>
    </div>
  );
}

/* -------------------- About -------------------- */
function About() {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [versionLabel, setVersionLabel] = useState("Version …");

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      NativeApp.getInfo()
        .then((i) => setVersionLabel(`Version ${i.version} · Android`))
        .catch(() => setVersionLabel("Version · Android"));
    } else {
      setVersionLabel("Web preview");
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (checkingUpdate || !Capacitor.isNativePlatform()) return;
    
    setCheckingUpdate(true);
    setUpdateStatus(null);
    setUpdateError(null);

    try {
      // Clear cache to bypass cooldown for manual check
      await clearUpdateCache();
      
      const result = await checkForUpdates(true);
      
      if (result.hasUpdate && result.updateInfo) {
        setUpdateStatus(`Update available: ${result.updateInfo.latestVersionName}`);
      } else if (result.status === "up_to_date") {
        setUpdateStatus("You're up to date");
      } else if (result.status === "check_failed") {
        setUpdateError(result.error || "Failed to check for updates");
      }
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface border border-border p-5 flex flex-col items-center text-center">
        <span
          className="bg-foreground text-background flex overflow-hidden"
          style={{ borderRadius: 20 }}
        >
          <ChatZMark size={64} glyphOnly bg="transparent" fg="currentColor" />
        </span>
        <div className="mt-3 text-[22px] font-semibold tracking-tight">
          Chat<span className="font-bold">Z</span>
        </div>
        <div className="text-[12px] text-muted-foreground mt-0.5">{versionLabel}</div>
        <p className="mt-3 text-[13px] text-muted-foreground leading-relaxed max-w-xs">
          A private, friend-only screen-time app. Share how your day looks with the people you
          trust — never a public feed, never ads.
        </p>
        
        {/* Check for updates button */}
        <button
          onClick={handleCheckForUpdates}
          disabled={checkingUpdate || !Capacitor.isNativePlatform()}
          className="mt-4 h-10 px-5 rounded-full bg-primary text-primary-foreground text-[14px] font-medium flex items-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
        >
          {checkingUpdate ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Download size={16} />
              Check for updates
            </>
          )}
        </button>
        
        {updateStatus && (
          <p className="mt-2 text-[13px] text-success">{updateStatus}</p>
        )}
        {updateError && (
          <p className="mt-2 text-[13px] text-destructive">{updateError}</p>
        )}
        {!Capacitor.isNativePlatform() && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Updates only available in the installed Android app
          </p>
        )}
      </div>

      <section className="rounded-2xl bg-surface border border-border overflow-hidden">
        <ul className="divide-y divide-border text-[14px]">
          <li className="px-4 py-3 flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-secondary grid place-items-center shrink-0 text-muted-foreground">
              <Check size={15} />
            </span>
            <span className="text-muted-foreground leading-relaxed">
              <b className="text-foreground font-medium">On-device first.</b> Screen time is
              summarised on your phone; only the summary is uploaded, and only when you allow it.
            </span>
          </li>
          <li className="px-4 py-3 flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-secondary grid place-items-center shrink-0 text-muted-foreground">
              <Shield size={15} />
            </span>
            <span className="text-muted-foreground leading-relaxed">
              <b className="text-foreground font-medium">Friend-only.</b> Your stats are readable
              only by friends you've accepted, enforced by server-side rules.
            </span>
          </li>
          <li className="px-4 py-3 flex items-start gap-3">
            <span className="w-8 h-8 rounded-full bg-secondary grid place-items-center shrink-0 text-muted-foreground">
              <RefreshCw size={15} />
            </span>
            <span className="text-muted-foreground leading-relaxed">
              <b className="text-foreground font-medium">You're in control.</b> Every permission
              and privacy category can be changed or revoked at any time.
            </span>
          </li>
        </ul>
      </section>

      <section>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 px-1">
          Legal & help
        </div>
        <ul className="rounded-2xl bg-surface border border-border overflow-hidden">
          <li className="border-b border-border">
            <Link
              to="/app/settings/privacy"
              className="px-4 py-3.5 flex items-center gap-3 active:bg-secondary"
            >
              <span className="w-9 h-9 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <Shield size={17} />
              </span>
              <span className="flex-1 text-[15px] font-medium">Privacy Policy</span>
              <ChevronLeft size={16} className="text-muted-foreground rotate-180" />
            </Link>
          </li>
          <li>
            <Link
              to="/app/settings/help"
              className="px-4 py-3.5 flex items-center gap-3 active:bg-secondary"
            >
              <span className="w-9 h-9 rounded-full bg-secondary grid place-items-center text-muted-foreground">
                <LifeBuoy size={17} />
              </span>
              <span className="flex-1 text-[15px] font-medium">Help & Support</span>
              <ChevronLeft size={16} className="text-muted-foreground rotate-180" />
            </Link>
          </li>
        </ul>
      </section>

      <section>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 px-1">
          Contact
        </div>
        <Contacts />
      </section>

      <p className="text-center text-[11px] text-muted-foreground leading-relaxed px-4">
        ChatZ is an independent project. Google, Android and Firebase are trademarks of Google LLC.
      </p>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  sub,
  href,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  href: string;
  last?: boolean;
}) {
  return (
    <li className={last ? "" : "border-b border-border"}>
      <a href={href} className="px-4 py-3.5 flex items-center gap-3 active:bg-secondary">
        <span className="w-9 h-9 rounded-full bg-secondary grid place-items-center text-muted-foreground shrink-0">
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <div className="text-[15px] font-medium">{label}</div>
          <div className="text-[12px] text-muted-foreground leading-snug">{sub}</div>
        </span>
      </a>
    </li>
  );
}

/* -------------------- Blocked accounts -------------------- */
function Blocked() {
  const profile = useProfile();
  const myUid = profile?.uid ?? "";
  const [list, setList] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<BlockedUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!myUid) return;
    let cancelled = false;
    setError("");
    listBlocked(myUid)
      .then((rows) => {
        if (!cancelled) setList(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setList([]);
          setError("Couldn't load your blocked accounts — check your connection.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [myUid]);

  const confirmUnblock = async () => {
    const target = confirming;
    if (!myUid || !target || busy) return;
    setBusy(true);
    setError("");
    try {
      await unblockUser(myUid, target.uid);
      setList((l) => (l ?? []).filter((b) => b.uid !== target.uid));
      setConfirming(null);
    } catch {
      setError("Couldn't unblock — check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface border border-border p-4 flex items-start gap-3">
        <Ban size={18} className="text-destructive mt-0.5" />
        <div className="text-[13px] text-muted-foreground">
          Blocked people can't message you, see your profile, stats or online status, or send you
          friend requests. They aren't told they've been blocked. To block someone, open their
          profile and choose Block.
        </div>
      </div>

      {error && <p className="px-1 text-[13px] text-destructive">{error}</p>}

      {list === null ? (
        <div className="py-10 grid place-items-center text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">
          You haven't blocked anyone.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((b) => (
            <li
              key={b.uid}
              className="rounded-2xl bg-surface border border-border p-3 flex items-center gap-3"
            >
              <Avatar name={b.name} color={b.color} avatarId={b.avatarId} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold truncate">{b.name}</div>
                <div className="text-[12px] text-muted-foreground truncate">
                  {b.handle ? `@${b.handle} · ` : ""}
                  {b.at ? `Blocked ${relTime(b.at)}` : "Blocked"}
                </div>
              </div>
              <button
                onClick={() => setConfirming(b)}
                disabled={busy}
                className="h-8 px-3 rounded-full bg-secondary text-[13px] font-medium active:scale-95 disabled:opacity-60"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 bg-foreground/40 grid place-items-center p-6">
          <div className="w-full max-w-sm bg-background rounded-3xl p-5">
            <h3 className="text-lg font-semibold">Unblock {confirming.name}?</h3>
            <p className="text-[13px] text-muted-foreground mt-1">
              They'll be able to see your shared stats and send you a new friend request. You won't
              become friends again automatically.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirming(null)}
                disabled={busy}
                className="h-11 rounded-2xl bg-secondary font-medium text-[14px] active:scale-[0.98] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnblock}
                disabled={busy}
                className="h-11 rounded-2xl bg-foreground text-background font-medium text-[14px] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                Unblock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
