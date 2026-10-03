import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { getPublicProfile, type PublicProfile } from "@/lib/profile-repo";
import { useProfile } from "@/lib/profile-store";
import {
  ALL_SHARED,
  fetchPresence,
  localDay,
  subscribeUsageStats,
  type Presence,
  type UsageStats,
} from "@/lib/usage-repo";
import { areFriends, fetchFriendCount, unfriend } from "@/lib/friends-repo";
import { blockUser, fetchBlockState, unblockUser, type BlockState } from "@/lib/blocks-repo";
import { REPORT_REASONS, reportUser, type ReportReason } from "@/lib/reports-repo";
import { Avatar } from "@/components/Avatar";
import { StatSocial } from "@/components/StatSocial";
import { formatMs, relTime } from "@/components/stat-ui";
import {
  ChevronLeft,
  MessageCircle,
  BarChart3,
  Clock,
  Instagram,
  Facebook,
  Twitter,
  Send,
  Globe,
  MoreVertical,
  UserX,
  Flag,
  Ban,
  ShieldCheck,
  X,
  EyeOff,
  PauseCircle,
  CloudOff,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/app/user/$friendId")({
  head: () => ({ meta: [{ title: "Profile · ChatZ" }] }),
  component: UserProfile,
});

function UserProfile() {
  const { friendId } = Route.useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const myUid = profile?.uid ?? "";

  const [user, setUser] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockState, setBlockState] = useState<BlockState>({
    blockedByMe: false,
    blockedByThem: false,
  });
  const [isFriend, setIsFriend] = useState(false);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<"unfriend" | "block" | "unblock" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [reportErr, setReportErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Everything is reset per friendId (and per signed-in account): a stale
    // profile or block state from another account must never flash here.
    setLoading(true);
    setUser(null);
    setStats(null);
    setPresence(null);
    setIsFriend(false);
    setFriendCount(null);
    setBlockState({ blockedByMe: false, blockedByThem: false });

    getPublicProfile(friendId)
      .catch(() => null)
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setLoading(false);
      });
    fetchPresence(friendId)
      .catch(() => null)
      .then((p) => {
        if (!cancelled) setPresence(p);
      });
    // A denied subscription is expected while a block is in place — the blocked
    // screens explain the lost access, so the error callback stays silent.
    const off = subscribeUsageStats(
      friendId,
      (s) => {
        if (!cancelled) setStats(s);
      },
      () => {},
    );

    if (myUid) {
      fetchBlockState(myUid, friendId)
        .catch(() => ({ blockedByMe: false, blockedByThem: false }))
        .then((b) => {
          if (!cancelled) setBlockState(b);
        });
      areFriends(myUid, friendId)
        .catch(() => false)
        .then((f) => {
          if (!cancelled) setIsFriend(f);
        });
    }
    fetchFriendCount(friendId)
      .catch(() => null)
      .then((n) => {
        if (!cancelled) setFriendCount(n);
      });

    return () => {
      cancelled = true;
      off();
    };
  }, [friendId, myUid, reloadKey]);

  const sh = stats?.shared ?? ALL_SHARED;
  const isToday = stats?.day === localDay();
  const silent = stats?.mode === "silent";
  const showScreen = !!stats && isToday && sh.screenTime && !silent;
  const blocked = blockState.blockedByMe || blockState.blockedByThem;
  const who = user ? firstName(user.name) : "";
  const whoThey = who || "They";

  const runAction = (key: "unfriend" | "report" | "block" | "unblock") => {
    setMenuOpen(false);
    setActionErr(null);
    if (key === "report") {
      setReportReason(null);
      setReportDetails("");
      setReportDone(false);
      setReportErr(null);
      setReportOpen(true);
    } else {
      setConfirm(key);
    }
  };

  const doUnblock = async () => {
    if (!myUid) return;
    setActionBusy(true);
    setActionErr(null);
    try {
      await unblockUser(myUid, friendId);
      setConfirm(null);
      setBlockState((s) => ({ ...s, blockedByMe: false }));
      setReloadKey((k) => k + 1);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Couldn't unblock. Try again.");
    } finally {
      setActionBusy(false);
    }
  };

  const runConfirm = async () => {
    if (!myUid || !confirm) return;
    if (confirm === "unblock") {
      await doUnblock();
      return;
    }
    if (!user) return;
    const actor = {
      name: profile?.name ?? "",
      handle: profile?.handle,
      color: profile?.color ?? "#5E72E4",
      avatarId: profile?.avatarId,
    };
    setActionBusy(true);
    setActionErr(null);
    try {
      if (confirm === "unfriend") {
        await unfriend(myUid, user.uid, actor);
      } else {
        await blockUser(
          myUid,
          user.uid,
          { name: user.name, handle: user.handle, color: user.color, avatarId: user.avatarId },
          actor,
        );
      }
      navigate({ to: "/app/friends" });
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Something went wrong. Try again.");
      setActionBusy(false);
    }
  };

  const submitReport = async () => {
    // Uids only: reporting stays possible even when the profile itself is
    // unreadable (the blocked case).
    if (!myUid || !reportReason) return;
    setReportSending(true);
    setReportErr(null);
    const ok = await reportUser(myUid, friendId, reportReason, reportDetails);
    setReportSending(false);
    if (!ok) {
      setReportErr("Couldn't send the report. Try again.");
      return;
    }
    setReportDone(true);
  };

  const actions: Array<{
    key: "unfriend" | "report" | "block" | "unblock";
    label: string;
    icon: ReactNode;
    destructive?: boolean;
  }> = [];
  if (blockState.blockedByMe) {
    actions.push({ key: "unblock", label: who ? `Unblock ${who}` : "Unblock", icon: <ShieldCheck size={17} /> });
    actions.push({ key: "report", label: "Report", icon: <Flag size={17} /> });
  } else if (blockState.blockedByThem) {
    actions.push({ key: "report", label: "Report", icon: <Flag size={17} /> });
  } else {
    if (isFriend) {
      actions.push({
        key: "unfriend",
        label: who ? `Unfriend ${who}` : "Unfriend",
        icon: <UserX size={17} />,
        destructive: true,
      });
    }
    actions.push({ key: "report", label: who ? `Report ${who}` : "Report", icon: <Flag size={17} /> });
    actions.push({
      key: "block",
      label: who ? `Block ${who}` : "Block",
      icon: <Ban size={17} />,
      destructive: true,
    });
  }

  const socialChips = user?.socials ? socialEntries(user.socials) : [];

  return (
    <>
      <header className="sticky top-0 z-20 glass-blur safe-top px-3 pt-2 pb-2 flex items-center gap-2 border-b border-border/60">
        <button
          onClick={() => navigate({ to: "/app/friends" })}
          className="text-primary p-2 -ml-1 flex items-center"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 text-center text-[13px] font-medium text-muted-foreground truncate">
          Profile
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="w-9 h-9 grid place-items-center text-foreground active:opacity-60"
          aria-label="Profile actions"
          disabled={loading && !user}
        >
          <MoreVertical size={20} />
        </button>
      </header>

      {loading ? (
        <div className="px-4 pt-5 space-y-4 animate-pulse">
          <div className="h-40 rounded-3xl bg-surface border border-border/60" />
          <div className="h-44 rounded-3xl bg-surface border border-border/60" />
        </div>
      ) : blockState.blockedByMe ? (
        <div className="px-4 pt-5 pb-10">
          <section className="rounded-3xl bg-surface border border-border/60 p-6 text-center">
            <span className="mx-auto w-12 h-12 rounded-full bg-secondary grid place-items-center text-muted-foreground">
              <Ban size={22} />
            </span>
            <h2 className="mt-3 text-[17px] font-semibold">You blocked this person</h2>
            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
              They can't message you, see your profile, stats or online status, or send you friend
              requests.
            </p>
            {actionErr && (
              <p className="mt-3 text-[12px] text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                {actionErr}
              </p>
            )}
            <button
              onClick={() => setConfirm("unblock")}
              disabled={actionBusy}
              className="mt-4 w-full h-11 rounded-2xl bg-foreground text-background text-[14px] font-medium disabled:opacity-60"
            >
              Unblock
            </button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Unblocking doesn't restore the friendship — they'd need to send a new friend request.
            </p>
          </section>
        </div>
      ) : blockState.blockedByThem ? (
        <div className="px-4 pt-5 pb-10">
          <section className="rounded-3xl bg-surface border border-border/60 p-6 text-center">
            <span className="mx-auto w-12 h-12 rounded-full bg-secondary grid place-items-center text-muted-foreground">
              <Ban size={22} />
            </span>
            <h2 className="mt-3 text-[17px] font-semibold">Profile unavailable</h2>
            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
              You can no longer view this profile because this user blocked you. You can't message
              them, see their stats or send a friend request from this account.
            </p>
          </section>
        </div>
      ) : !user ? (
        <div className="p-6 text-center text-muted-foreground">
          User not found.{" "}
          <Link to="/app/friends" className="text-primary">
            Back
          </Link>
        </div>
      ) : (
        <div className="px-4 pt-5 pb-10 space-y-4">
          {/* Identity hero */}
          <section className="rounded-3xl bg-surface border border-border/60 px-5 pt-6 pb-5 flex flex-col items-center text-center">
            <span className="relative">
              <Avatar name={user.name} color={user.color} avatarId={user.avatarId} frame={user.frame} size="2xl" />
              {presence?.online && (
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-[3px] ring-surface" />
              )}
            </span>
            <h1 className="mt-3 text-[22px] font-semibold tracking-tight truncate max-w-full">
              {user.name}
            </h1>
            <div className="text-[13px] text-muted-foreground">@{user.handle}</div>
            {friendCount !== null && (
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {friendCount} {friendCount === 1 ? "friend" : "friends"}
              </div>
            )}
            {presence?.online ? (
              <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-emerald-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active now
              </div>
            ) : presence?.lastSeen ? (
              <div className="mt-1.5 text-[12px] text-muted-foreground">
                Last seen {relTime(presence.lastSeen)}
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2 w-full">
              {isFriend ? (
                <>
                  <Link
                    to="/app/chats/$chatId"
                    params={{ chatId: user.uid }}
                    className="rounded-2xl bg-primary text-primary-foreground py-3 flex items-center justify-center gap-2 font-medium text-[14px] active:scale-[0.98]"
                  >
                    <MessageCircle size={17} /> Message
                  </Link>
                  <Link
                    to="/app/stats/$friendId"
                    params={{ friendId: user.uid }}
                    className="rounded-2xl bg-secondary py-3 flex items-center justify-center gap-2 font-medium text-[14px] active:scale-[0.98]"
                  >
                    <BarChart3 size={17} /> Full stats
                  </Link>
                </>
              ) : (
                <div className="col-span-2 rounded-2xl bg-secondary py-3 flex flex-col items-center justify-center px-4 text-center">
                  <span className="text-[14px] font-medium">Not friends yet</span>
                  <span className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                    Send a friend request from the Friends tab to chat and share stats.
                  </span>
                </div>
              )}
            </div>
          </section>

          {user.bio && (
            <section className="rounded-3xl bg-surface border border-border/60 px-5 py-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                About
              </div>
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                {user.bio}
              </p>
            </section>
          )}

          {socialChips.length > 0 && (
            <section className="rounded-3xl bg-surface border border-border/60 px-5 py-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5">
                Links
              </div>
              <div className="flex flex-wrap gap-2">
                {socialChips.map((s) => (
                  <a
                    key={s.kind}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="h-9 px-3.5 rounded-full bg-secondary text-[13px] font-medium flex items-center gap-1.5 active:scale-95"
                  >
                    {s.icon}
                    {s.label}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Today's shared snapshot */}
          <section className="rounded-3xl bg-surface border border-border/60 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Today
              </div>
              <Link
                to="/app/stats/$friendId"
                params={{ friendId: user.uid }}
                className="text-[12px] text-primary font-medium"
              >
                View all
              </Link>
            </div>

            {silent ? (
              <div className="text-center py-4">
                <PauseCircle size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-[14px] font-medium">Stats sharing is paused</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {whoThey} turned on Silent mode. Nothing is shared until they switch back to
                  Active.
                </p>
              </div>
            ) : !stats ? (
              <div className="text-center py-4">
                <Clock size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-[14px] font-medium">Waiting for stats</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {whoThey} haven't synced a snapshot yet.
                </p>
              </div>
            ) : !isToday ? (
              <div className="text-center py-4">
                <Clock size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-[14px] font-medium">Waiting for stats</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Waiting for today's sync
                  {stats.syncedAt ? ` · last update ${relTime(stats.syncedAt)}` : ""}
                </p>
              </div>
            ) : stats.blocked ? (
              <div className="text-center py-4">
                <CloudOff size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-[14px] font-medium">Not syncing right now</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {whoThey}'s phone isn't sending stats at the moment — their sharing settings
                  haven't changed. Numbers return on the next sync.
                </p>
              </div>
            ) : (
              <>
                {sh.screenTime ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] text-muted-foreground">Screen time today</div>
                      <div className="text-[30px] font-semibold tabular-nums tracking-tight">
                        {formatMs(stats.screenTimeTodayMs)}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground leading-relaxed">
                      {stats.syncedAt && (
                        <>
                          Updated
                          <br />
                          {relTime(stats.syncedAt)}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <EyeOff size={15} /> Screen time isn't shared
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {stats.syncedAt ? `Updated ${relTime(stats.syncedAt)}` : ""}
                    </div>
                  </div>
                )}

                {showScreen && (
                  <StatSocial
                    ownerUid={user.uid}
                    day={stats.day ?? localDay()}
                    compact
                    className="mt-3"
                  />
                )}

                {sh.topApps && stats.topApps.length > 0 && (
                  <ul className="mt-4 pt-4 border-t border-border/60 space-y-2.5">
                    {stats.topApps.slice(0, 3).map((a, i) => (
                      <li key={a.packageName || a.appName} className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg bg-secondary grid place-items-center text-[13px] font-semibold text-muted-foreground shrink-0">
                          {(a.appName || a.packageName || "?").trim().charAt(0).toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0 text-[14px] font-medium truncate">
                          {i === 0 && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1.5">
                              Top
                            </span>
                          )}
                          {a.appName || a.packageName}
                        </span>
                        <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">
                          {formatMs(a.usageMs)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* Action menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 flex items-end"
          onClick={() => setMenuOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto bg-background rounded-t-3xl p-6 safe-bottom"
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Actions</h3>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-8 h-8 grid place-items-center rounded-full bg-secondary"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-1">
              {actions.map((a) => (
                <button
                  key={a.key}
                  onClick={() => runAction(a.key)}
                  disabled={a.key !== "report" && !user && !blockState.blockedByMe}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl active:bg-secondary text-left text-[15px] font-medium disabled:opacity-40 ${
                    a.destructive ? "text-destructive" : ""
                  }`}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unfriend / Block / Unblock confirmation */}
      {confirm && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 grid place-items-center p-6"
          onClick={() => !actionBusy && setConfirm(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-background rounded-3xl p-5"
          >
            <h3 className="text-lg font-semibold">
              {confirm === "unfriend"
                ? `Unfriend ${who}?`
                : confirm === "block"
                  ? `Block ${who}?`
                  : `Unblock ${who}?`}
            </h3>
            <p className="text-[13px] text-muted-foreground mt-1">
              {confirm === "unfriend"
                ? "You'll both lose access to each other's shared stats and chats. They'll get a notification that you unfriended them."
                : confirm === "block"
                  ? "They won't be able to message you, see your profile, stats or online status, or send you friend requests. Any friendship and pending requests between you will be removed. Blocking doesn't report them."
                  : "They'll be able to see your shared stats and send you a new friend request. You won't become friends again automatically."}
            </p>
            {actionErr && (
              <p className="mt-3 text-[12px] text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                {actionErr}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirm(null)}
                disabled={actionBusy}
                className="h-11 rounded-2xl bg-secondary text-[14px] font-medium disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => void runConfirm()}
                disabled={actionBusy}
                className={`h-11 rounded-2xl text-[14px] font-medium disabled:opacity-60 ${
                  confirm === "unblock"
                    ? "bg-foreground text-background"
                    : "bg-destructive text-destructive-foreground"
                }`}
              >
                {actionBusy ? "…" : confirm === "unfriend" ? "Unfriend" : confirm === "block" ? "Block" : "Unblock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report sheet */}
      {reportOpen && (
        <div
          className="fixed inset-0 z-50 bg-foreground/40 flex items-end"
          onClick={() => !reportSending && setReportOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto bg-background rounded-t-3xl p-6 safe-bottom max-h-[85vh] overflow-y-auto"
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4" />
            {reportDone ? (
              <div className="text-center py-2">
                <span className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary grid place-items-center">
                  <Check size={22} />
                </span>
                <h3 className="mt-3 text-lg font-semibold">Report sent</h3>
                <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                  Thanks for helping keep ChatZ safe. {who ? `${who} won't` : "They won't"} be told
                  who reported them.
                </p>
                <button
                  onClick={() => setReportOpen(false)}
                  className="mt-4 w-full h-11 rounded-2xl bg-foreground text-background text-[14px] font-medium"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-semibold">{who ? `Report ${who}` : "Report"}</h3>
                  <button
                    onClick={() => setReportOpen(false)}
                    className="w-8 h-8 grid place-items-center rounded-full bg-secondary"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-[12px] text-muted-foreground mb-3">
                  Reports are private. They won't see who reported them, and reporting doesn't block
                  or unfriend anyone.
                </p>
                <div className="space-y-1">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setReportReason(r.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[14px] ${
                        reportReason === r.value ? "bg-secondary font-medium" : ""
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${
                          reportReason === r.value ? "border-primary" : "border-border"
                        }`}
                      >
                        {reportReason === r.value && (
                          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </span>
                      {r.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value.slice(0, 1000))}
                  placeholder="Add details (optional)"
                  className="mt-3 w-full bg-secondary rounded-xl p-3 text-[14px] min-h-[88px] outline-none resize-none"
                />
                {reportErr && (
                  <p className="mt-2 text-[12px] text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                    {reportErr}
                  </p>
                )}
                <button
                  onClick={() => void submitReport()}
                  disabled={!reportReason || reportSending}
                  className="mt-3 w-full h-11 rounded-2xl bg-primary text-primary-foreground text-[14px] font-medium disabled:opacity-40"
                >
                  {reportSending ? "Sending…" : "Send report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "They";
}

type SocialKind = "instagram" | "facebook" | "twitter" | "telegram" | "whatsapp";

const SOCIAL_META: Record<SocialKind, { label: string; icon: ReactNode; host: string }> = {
  instagram: { label: "Instagram", icon: <Instagram size={14} />, host: "instagram.com" },
  facebook: { label: "Facebook", icon: <Facebook size={14} />, host: "facebook.com" },
  twitter: { label: "X", icon: <Twitter size={14} />, host: "x.com" },
  telegram: { label: "Telegram", icon: <Send size={14} />, host: "t.me" },
  whatsapp: { label: "WhatsApp", icon: <Globe size={14} />, host: "wa.me" },
};

/** Safe href: a full http(s) link passes through, anything else is treated as a
 *  handle and host-prefixed — so no javascript:/data: URL can ever be rendered. */
function socialHref(kind: SocialKind, raw: string): string {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@+/, "");
  if (kind === "whatsapp") return `https://wa.me/${handle.replace(/[^\d]/g, "")}`;
  return `https://${SOCIAL_META[kind].host}/${handle}`;
}

function socialEntries(socials: NonNullable<PublicProfile["socials"]>) {
  const out: { kind: SocialKind; label: string; icon: ReactNode; href: string }[] = [];
  (Object.keys(SOCIAL_META) as SocialKind[]).forEach((kind) => {
    const raw = socials[kind];
    if (typeof raw !== "string" || !raw.trim()) return;
    out.push({
      kind,
      label: SOCIAL_META[kind].label,
      icon: SOCIAL_META[kind].icon,
      href: socialHref(kind, raw),
    });
  });
  return out;
}
