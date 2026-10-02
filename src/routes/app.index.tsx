import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useProfile, writeProfile } from "@/lib/profile-store";
import { Avatar } from "@/components/Avatar";
import { ChatZMark } from "@/components/Logo";
import {
  Bell,
  Battery,
  ChevronDown,
  ChevronRight,
  Clock,
  CloudOff,
  EyeOff,
  Flame,
  MessageCircle,
  Moon,
  PauseCircle,
  RefreshCw,
  Rocket,
  ShieldAlert,
  Signal,
  Smartphone,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import { useNotifs, unreadCount } from "@/lib/notifications-store";
import { VibeStats, type VibeStatsData } from "@/lib/vibe-stats";
import {
  ALL_SHARED,
  fetchUsageStatsFresh,
  localDay,
  subscribeUsageStats,
  type UsageStats,
} from "@/lib/usage-repo";
import { StatSocial } from "@/components/StatSocial";
import { formatBytes, formatMs, relTime } from "@/components/stat-ui";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Capacitor } from "@capacitor/core";
import { listFriends } from "@/lib/friends-repo";
import { bumpStreak, type PublicProfile } from "@/lib/profile-repo";
import { isChatUnread, useChatsOverview, useReadMarkers } from "@/lib/dm-repo";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Pulse · ChatZ" }] }),
  component: Pulse,
});

/** Home stays a glance, not a directory — the full list lives on Friends. */
const FRIEND_CARDS = 8;

function Pulse() {
  const profile = useProfile();

  const [stats, setStats] = useState<VibeStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [friends, setFriends] = useState<PublicProfile[] | null>(null);
  const [refreshingFriends, setRefreshingFriends] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);

  // The day-streak advances on first launch each day; re-bumping when the app
  // returns to the foreground covers the day rolling over while it stays open.
  useEffect(() => {
    const uid = profile?.uid;
    if (!uid) return;
    let cancelled = false;
    const bump = () =>
      bumpStreak(uid)
        .then((s) => {
          if (!cancelled) setStreak(s);
        })
        .catch(() => {});
    bump();
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [profile?.uid]);

  // Pull every friend's snapshot straight from the server; each FriendCard's
  // live subscription picks the fresh document up and re-renders, mode included.
  // The spinner always runs at least ~650ms — a cache-hit refresh would
  // otherwise finish before the circular animation is visible at all.
  const refreshFriends = async () => {
    if (!friends || friends.length === 0 || refreshingFriends) return;
    setRefreshingFriends(true);
    try {
      const [results] = await Promise.all([
        Promise.allSettled(friends.map((f) => fetchUsageStatsFresh(f.uid))),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
      void results;
    } finally {
      setRefreshingFriends(false);
    }
  };

  // Friends are always visible — sorted alphabetically; stat sorting needs the
  // live per-card subscriptions, which render below in each FriendCard.
  const sortedFriends = useMemo(() => {
    if (!friends) return [];
    return [...friends].sort((a, b) => a.name.localeCompare(b.name));
  }, [friends]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      if (Capacitor.isNativePlatform()) {
        // Usage access is the gate: without it the collector would report zeros,
        // and a zero is invented data — show the honest "no access" state instead.
        const { granted } = await VibeStats.checkUsageAccess();
        if (!granted) {
          setNoAccess(true);
          setStats(null);
          return;
        }
        setNoAccess(false);
        const data = await VibeStats.collectStats();
        setStats(data);
      } else {
        setNoAccess(false);
        setStats(null);
        setError("Screen-time stats are only available in the Android app.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // The live numbers above come from the device right now; this is when the
  // background worker last pushed a snapshot that friends can actually read.
  useEffect(() => {
    const uid = profile?.uid;
    if (!uid || !Capacitor.isNativePlatform()) return;
    return subscribeUsageStats(uid, (remote) => setLastSync(remote?.syncedAt ?? null));
  }, [profile?.uid]);

  useEffect(() => {
    const uid = profile?.uid;
    if (!uid) return;
    let cancelled = false;
    setFriends(null);
    listFriends(uid)
      .then((f) => {
        if (!cancelled) setFriends(f);
      })
      .catch(() => {
        if (!cancelled) setFriends([]);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  const chats = useChatsOverview(profile?.uid ?? null);
  const markers = useReadMarkers(profile?.uid ?? null);

  const notifs = useNotifs();
  const unread = unreadCount(notifs);

  const goalMinutes = (profile?.goalHours ?? 4) * 60;
  const screenMinutes = stats ? Math.round(stats.screenTimeTodayMs / 60000) : 0;
  const pct = goalMinutes > 0 ? Math.min(100, (screenMinutes / goalMinutes) * 100) : 0;
  const overGoal = screenMinutes > goalMinutes;

  const mode = profile?.mode === "silent" ? "silent" : "active";
  const setMode = (m: "active" | "silent") => {
    if (!profile || (profile.mode ?? "active") === m) return;
    // The app shell mirrors this to Firestore and the native worker.
    writeProfile({ ...profile, mode: m });
  };

  return (
    <>
      <header className="sticky top-0 z-20 glass-blur safe-top px-5 pt-2 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="rounded-[10px] overflow-hidden bg-foreground text-background flex">
            <ChatZMark size={32} glyphOnly bg="transparent" fg="currentColor" />
          </span>
          <span className="text-[20px] font-semibold tracking-tight">
            Chat<span className="font-bold">Z</span>
          </span>
        </div>
        <Link
          to="/app/notifications"
          className="relative w-9 h-9 rounded-full bg-secondary grid place-items-center active:scale-95"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center ring-2 ring-background tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </header>

      <div className="px-4 pt-4 pb-6 space-y-4">
        <ModeControl mode={mode} onChange={setMode} />

        <section className="rounded-3xl p-5 bg-gradient-to-br from-primary to-[oklch(0.55_0.2_260)] text-primary-foreground shadow-[0_18px_40px_-20px_color-mix(in_oklab,var(--color-primary)_60%,transparent)]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs opacity-80">Your day so far</div>
              <div className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">
                {loading ? (
                  <span className="opacity-60">...</span>
                ) : noAccess ? (
                  <span className="text-2xl font-semibold opacity-90 flex items-center gap-2">
                    <EyeOff size={22} /> No access
                  </span>
                ) : (
                  <>
                    {Math.floor(screenMinutes / 60)}h{" "}
                    <span className="opacity-80">{screenMinutes % 60}m</span>
                  </>
                )}
              </div>
              <div className="mt-0.5 text-[13px] opacity-80">
                {noAccess ? "Screen-time access is off" : <>Goal · {profile?.goalHours ?? 4}h</>}
              </div>
            </div>
            {profile && (
              <Avatar
                name={profile.name}
                color={profile.color}
                avatarId={profile.avatarId}
                size="xl"
              />
            )}
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/20 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${overGoal ? "bg-warning" : "bg-white"}`}
              style={{ width: `${noAccess ? 0 : pct}%` }}
            />
          </div>

          {noAccess && (
            <Link
              to="/app/settings/permissions"
              className="mt-4 flex items-center justify-center gap-2 h-10 rounded-full bg-white/20 text-[13px] font-medium active:scale-[0.98] transition"
            >
              <ShieldAlert size={15} /> Grant screen-time access
            </Link>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            {stats && profile?.uid && (
              <div className="flex-1 min-w-0">
                <StatSocial
                  ownerUid={profile.uid}
                  day={localDay()}
                  isSelf
                  commentFirst
                  className=""
                />
              </div>
            )}
            {streak != null && (
              <span
                className="h-8 px-2.5 rounded-full bg-white/15 flex items-center gap-1 text-[13px] font-medium tabular-nums shrink-0"
                title={`${streak}-day streak`}
                aria-label={`${streak}-day streak`}
              >
                <Flame size={14} className="text-warning" /> {streak}
              </span>
            )}
            <button
              onClick={fetchStats}
              disabled={loading}
              className="w-8 h-8 rounded-full bg-white/20 grid place-items-center shrink-0 active:scale-95 transition disabled:opacity-60"
              aria-label="Refresh stats"
            >
              {loading ? (
                <span
                  className="w-3.5 h-3.5 rounded-full border-2 border-white/25 border-t-white animate-spin"
                  role="status"
                  aria-label="Refreshing"
                />
              ) : (
                <RefreshCw size={14} />
              )}
            </button>
          </div>

          {stats && (
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mt-4">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group w-full h-9 rounded-2xl bg-white/10 flex items-center justify-center gap-1.5 text-[12px] font-medium tracking-tight active:scale-[0.99] transition"
                >
                  Device details
                  <ChevronDown
                    size={14}
                    className="transition-transform duration-300 group-data-[state=open]:rotate-180"
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="collapsible-content">
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    <HeroTile
                      icon={<Clock size={12} />}
                      label="Screen time"
                      value={stats.screenTimeFormatted}
                    />
                    <HeroTile
                      icon={<Battery size={12} />}
                      label="Battery"
                      value={`${stats.batteryPercent}%${stats.isCharging ? " ⚡" : ""}`}
                    />
                    <HeroTile
                      icon={<Wifi size={12} />}
                      label="Wi-Fi data"
                      value={stats.wifiDataFormatted}
                    />
                    <HeroTile
                      icon={<Signal size={12} />}
                      label="Mobile data"
                      value={stats.mobileDataFormatted}
                    />
                    <HeroTile
                      icon={<Bell size={12} />}
                      label="Notifications"
                      value={String(stats.notificationCount)}
                    />
                    <HeroTile
                      icon={<Rocket size={12} />}
                      label="App launches"
                      value={String(stats.launchCount)}
                    />
                  </div>

                  <div className="rounded-2xl bg-white/10 px-3.5 py-3 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-medium min-w-0">
                      <Smartphone size={14} className="shrink-0 opacity-80" />
                      <span className="truncate">{stats.deviceModel || "This device"}</span>
                    </span>
                    <span className="text-[12px] opacity-75 shrink-0">
                      {stats.androidVersion || "—"}
                    </span>
                  </div>

                  {stats.topApps.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] uppercase tracking-wider opacity-75 font-medium">
                          Top apps today
                        </span>
                        <span className="text-[11px] opacity-75 tabular-nums">
                          {formatMs(stats.topApps.reduce((sum, a) => sum + a.usageMs, 0))} in apps
                        </span>
                      </div>
                      <ul className="space-y-3">
                        {stats.topApps.slice(0, 10).map((app) => {
                          const share =
                            stats.screenTimeTodayMs > 0
                              ? (app.usageMs / stats.screenTimeTodayMs) * 100
                              : 0;
                          return (
                            <li key={app.packageName} className="flex items-center gap-3">
                              <span className="w-9 h-9 rounded-[10px] bg-white/15 grid place-items-center text-[14px] font-semibold shrink-0">
                                {(app.appName || app.packageName || "?").trim().charAt(0).toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[14px] font-medium truncate">
                                    {app.appName || app.packageName}
                                  </span>
                                  <span className="text-[12px] opacity-80 tabular-nums shrink-0">
                                    {formatMs(app.usageMs)}
                                    {share >= 1 && (
                                      <span className="opacity-70"> · {Math.round(share)}%</span>
                                    )}
                                  </span>
                                </div>
                                <div className="mt-1.5 h-1.5 rounded-full bg-white/15 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-white transition-all"
                                    style={{ width: `${Math.max(2, Math.min(100, share))}%` }}
                                  />
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[12px] opacity-80 flex-wrap">
                    {stats.isOnWifi && (
                      <span className="flex items-center gap-1">
                        <Wifi size={12} /> Wi-Fi
                      </span>
                    )}
                    {stats.isOnMobile && (
                      <span className="flex items-center gap-1">
                        <Signal size={12} /> Cellular
                      </span>
                    )}
                    {stats.maskedSsid && (
                      <span className="flex items-center gap-1 min-w-0">
                        <Smartphone size={12} className="shrink-0" />
                        <span className="truncate">{stats.maskedSsid}</span>
                      </span>
                    )}
                  </div>

                  <div className="pt-1 text-center space-y-1">
                    <p className="text-[11px] opacity-75">
                      {mode === "silent"
                        ? "Sharing paused — friends can't see your stats"
                        : lastSync
                          ? `Last synced to friends ${relTime(lastSync)}`
                          : "Not synced to friends yet"}
                    </p>
                    <p className="text-[10px] opacity-55">
                      Background sync is scheduled every ~15 min via Android WorkManager; the
                      system may delay it.
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </section>

        {!stats && error && (
          <div className="rounded-3xl bg-surface border border-border p-5 text-center">
            <Smartphone size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-[13px] text-muted-foreground">{error}</p>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between px-1 pb-2.5">
            <h2 className="text-[15px] font-semibold tracking-tight">Friends</h2>
            <div className="flex items-center gap-3">
              {(friends?.length ?? 0) > FRIEND_CARDS && (
                <Link to="/app/friends" className="text-[13px] text-primary font-medium">
                  See all
                </Link>
              )}
              {friends && friends.length > 0 && (
                <button
                  onClick={refreshFriends}
                  disabled={refreshingFriends}
                  className="w-8 h-8 rounded-full bg-secondary grid place-items-center shrink-0 active:scale-95 transition disabled:opacity-70 text-primary"
                  aria-label="Refresh friends' stats"
                >
                  {refreshingFriends ? (
                    <span
                      className="w-3.5 h-3.5 rounded-full border-2 border-primary/25 border-t-primary animate-spin"
                      role="status"
                      aria-label="Refreshing"
                    />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                </button>
              )}
            </div>
          </div>

          {friends === null ? (
            <div className="h-[104px] rounded-3xl bg-surface border border-border/60 animate-pulse" />
          ) : friends.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-6 text-center">
              <Users size={22} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-[13px] text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
                No friends yet — add someone to see their screen time here.
              </p>
              <Link
                to="/app/friends"
                className="mt-3.5 inline-flex h-9 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-medium items-center active:scale-[0.98] transition"
              >
                Find friends
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedFriends.slice(0, FRIEND_CARDS).map((f) => (
                <FriendCard
                  key={f.uid}
                  friend={f}
                  unread={isChatUnread(chats.get(f.uid), markers)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function HeroTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-75 font-medium">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-[17px] font-semibold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}

/**
 * A friend on Home: live snapshot subscription, so new numbers appear without a
 * re-login, and an honest state when the snapshot is missing, stale, or hidden —
 * "Waiting for stats" is never mistaken for zero screen time. The summary row
 * opens that friend's statistics page; the chevron unfolds their device details
 * in place (same shutter as the owner's card), honoring their share flags.
 */
function FriendCard({
  friend,
  unread,
}: {
  friend: PublicProfile;
  unread: boolean;
}) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setStats(null);
    setDetailsOpen(false);
    return subscribeUsageStats(friend.uid, (s) => {
      setStats(s);
      setLoaded(true);
    });
  }, [friend.uid]);

  const isToday = stats?.day === localDay();
  // Silent wins over everything: the owner paused sharing, so nothing about the
  // current numbers may be shown even if an older active snapshot still exists.
  const silent = stats?.mode === "silent";
  const showScreen = !!stats && !silent && isToday && stats.shared.screenTime;
  const profile = `/app/user/${friend.uid}` as const;
  // A snapshot written before the flags existed has no `shared` map; treat it as
  // fully shared, same as the friend stats page does.
  const sh = stats?.shared ?? ALL_SHARED;
  const fresh = !!stats && isToday && !silent;

  return (
    <Collapsible
      open={detailsOpen}
      onOpenChange={setDetailsOpen}
      className="rounded-3xl bg-surface border border-border/60 p-4"
    >
      <div className="flex items-center gap-3">
        <Link to={profile} className="relative shrink-0">
          <Avatar name={friend.name} color={friend.color} avatarId={friend.avatarId} size="md" />
        </Link>
        <Link to={profile} className="flex-1 min-w-0">
          <div className="text-[15px] font-medium tracking-tight truncate">{friend.name}</div>
          <div className="text-[12px] text-muted-foreground truncate">
            @{friend.handle || "chatz"}
          </div>
        </Link>
        <Link
          to="/app/chats/$chatId"
          params={{ chatId: friend.uid }}
          className="relative w-10 h-10 rounded-full bg-secondary grid place-items-center active:scale-95 transition"
          aria-label={`Message ${friend.name}`}
        >
          <MessageCircle size={17} />
          {unread && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary ring-2 ring-surface" />
          )}
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-2 min-h-[36px]">
        <Link
          to="/app/stats/$friendId"
          params={{ friendId: friend.uid }}
          aria-label={`View ${friend.name}'s statistics`}
          className="flex-1 min-w-0 flex items-baseline gap-2 active:opacity-60 transition"
        >
          {!loaded ? (
            <span className="text-[13px] text-muted-foreground">Loading…</span>
          ) : !stats ? (
            <span className="text-[13px] text-muted-foreground">Waiting for stats</span>
          ) : silent ? (
            <span className="text-[13px] text-muted-foreground flex items-center gap-1.5">
              <PauseCircle size={13} /> Stats sharing is paused
            </span>
          ) : !isToday ? (
            <>
              <span className="text-[13px] text-muted-foreground">Waiting for stats</span>
              {stats.syncedAt && (
                <span className="text-[11px] text-muted-foreground/70">
                  last update {relTime(stats.syncedAt)}
                </span>
              )}
            </>
          ) : stats.blocked ? (
            <span className="text-[13px] text-muted-foreground flex items-center gap-1.5">
              <CloudOff size={13} /> Not syncing right now
            </span>
          ) : !stats.shared.screenTime ? (
            <span className="text-[13px] text-muted-foreground flex items-center gap-1.5">
              <EyeOff size={13} /> Screen time hidden
            </span>
          ) : (
            <>
              <span className="text-[22px] font-semibold tabular-nums tracking-tight">
                {formatMs(stats.screenTimeTodayMs)}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {stats.syncedAt ? `updated ${relTime(stats.syncedAt)}` : "today"}
              </span>
            </>
          )}
        </Link>
        {(friend.streak ?? 0) > 0 && (
          <span
            className="h-7 px-2 rounded-full bg-secondary flex items-center gap-1 text-[12px] font-medium text-muted-foreground tabular-nums shrink-0"
            title={`${friend.name}'s ${friend.streak}-day streak`}
            aria-label={`${friend.name}'s ${friend.streak}-day streak`}
          >
            <Flame size={12} className="text-warning" /> {friend.streak}
          </span>
        )}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group w-9 h-9 shrink-0 rounded-full bg-secondary grid place-items-center active:scale-95 transition"
            aria-label={detailsOpen ? "Hide device details" : "Show device details"}
          >
            <ChevronDown
              size={16}
              className="text-muted-foreground transition-transform duration-300 group-data-[state=open]:rotate-180"
            />
          </button>
        </CollapsibleTrigger>
      </div>

      {showScreen && stats && (
        <StatSocial ownerUid={friend.uid} day={stats.day ?? localDay()} compact className="mt-3" />
      )}

      <CollapsibleContent className="collapsible-content">
        <div className="pt-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5 px-0.5">
            Showing {friend.name}'s device
          </div>

          {silent ? (
            <p className="text-[13px] text-muted-foreground px-0.5 flex items-center gap-1.5">
              <PauseCircle size={13} /> Stats sharing is paused — {friend.name}'s numbers stay
              hidden until they switch back to Active.
            </p>
          ) : stats?.blocked ? (
            <p className="text-[13px] text-muted-foreground px-0.5 flex items-center gap-1.5">
              <CloudOff size={13} /> {friend.name}'s phone isn't sending stats at the moment —
              they'll reappear on the next sync.
            </p>
          ) : !fresh || !stats ? (
            <p className="text-[13px] text-muted-foreground px-0.5">
              No details from today yet — they appear after {friend.name}'s next sync.
            </p>
          ) : (
            <div className="space-y-4">
              {(sh.screenTime || sh.battery || sh.dataUsage || sh.notifications || sh.launches) && (
                <div className="grid grid-cols-2 gap-2.5">
                  {sh.screenTime && (
                    <FriendTile
                      icon={<Clock size={12} />}
                      label="Screen time"
                      value={formatMs(stats.screenTimeTodayMs)}
                    />
                  )}
                  {sh.battery && (
                    <FriendTile
                      icon={<Battery size={12} />}
                      label="Battery"
                      value={`${stats.batteryPercent}%${stats.isCharging ? " ⚡" : ""}`}
                    />
                  )}
                  {sh.dataUsage && (
                    <FriendTile
                      icon={<Wifi size={12} />}
                      label="Wi-Fi data"
                      value={formatBytes(stats.wifiDataUsedBytes)}
                    />
                  )}
                  {sh.dataUsage && (
                    <FriendTile
                      icon={<Signal size={12} />}
                      label="Mobile data"
                      value={formatBytes(stats.mobileDataUsedBytes)}
                    />
                  )}
                  {sh.notifications && (
                    <FriendTile
                      icon={<Bell size={12} />}
                      label="Notifications"
                      value={String(stats.notificationCount)}
                    />
                  )}
                  {sh.launches && (
                    <FriendTile
                      icon={<Rocket size={12} />}
                      label="App launches"
                      value={String(stats.launchCount)}
                    />
                  )}
                </div>
              )}

              {sh.deviceInfo && stats.deviceModel && (
                <div className="rounded-2xl bg-secondary px-3.5 py-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] font-medium min-w-0">
                    <Smartphone size={14} className="shrink-0 text-muted-foreground" />
                    <span className="truncate">{stats.deviceModel}</span>
                  </span>
                  {stats.androidVersion && (
                    <span className="text-[12px] text-muted-foreground shrink-0">
                      {stats.androidVersion}
                    </span>
                  )}
                </div>
              )}

              {sh.topApps && stats.topApps.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2.5 px-0.5">
                    Top apps today
                  </div>
                  <ul className="space-y-3">
                    {stats.topApps.slice(0, 3).map((app) => {
                      const share =
                        stats.screenTimeTodayMs > 0
                          ? (app.usageMs / stats.screenTimeTodayMs) * 100
                          : 0;
                      return (
                        <li key={app.packageName} className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-[9px] bg-secondary grid place-items-center text-[13px] font-semibold text-muted-foreground shrink-0">
                            {(app.appName || app.packageName || "?").trim().charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[13px] font-medium truncate">
                                {app.appName || app.packageName}
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                {formatMs(app.usageMs)}
                                {share >= 1 && (
                                  <span className="opacity-70"> · {Math.round(share)}%</span>
                                )}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.max(2, Math.min(100, share))}%` }}
                              />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {sh.wifi && (stats.isOnWifi || stats.isOnMobile || stats.maskedSsid) && (
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground flex-wrap px-0.5">
                  {stats.isOnWifi && (
                    <span className="flex items-center gap-1">
                      <Wifi size={12} /> Wi-Fi
                    </span>
                  )}
                  {stats.isOnMobile && (
                    <span className="flex items-center gap-1">
                      <Signal size={12} /> Cellular
                    </span>
                  )}
                  {stats.maskedSsid && (
                    <span className="flex items-center gap-1 min-w-0">
                      <Smartphone size={12} className="shrink-0" />
                      <span className="truncate">{stats.maskedSsid}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <Link
            to="/app/stats/$friendId"
            params={{ friendId: friend.uid }}
            className="mt-4 w-full h-9 rounded-2xl bg-secondary flex items-center justify-center gap-1.5 text-[12px] font-medium tracking-tight active:scale-[0.99] transition"
          >
            View full statistics
            <ChevronRight size={14} className="text-muted-foreground" />
          </Link>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FriendTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-[17px] font-semibold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}

/**
 * The one control that decides whether stats leave this device at all.
 * ACTIVE shares per the individual privacy toggles; SILENT pauses sharing
 * without touching them. The app shell mirrors every change to Firestore and
 * to the background worker as soon as it lands.
 */
function ModeControl({
  mode,
  onChange,
}: {
  mode: "active" | "silent";
  onChange: (m: "active" | "silent") => void;
}) {
  const silent = mode === "silent";
  return (
    <section className="rounded-3xl bg-foreground text-background px-4 py-3.5 shadow-[0_14px_36px_-18px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-3">
          <span
            className={`w-10 h-10 rounded-2xl grid place-items-center shrink-0 ${
              silent ? "bg-white/10" : "bg-success/20"
            }`}
          >
            {silent ? (
              <Moon size={18} className="opacity-80" />
            ) : (
              <Zap size={18} className="text-success" />
            )}
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider opacity-60 font-medium">
              Current mode
            </div>
            <div className="text-[16px] font-semibold tracking-tight leading-tight">
              {silent ? "Silent" : "Active"}
            </div>
            <div className="text-[11px] opacity-60 truncate">
              {silent ? "Friends can't see your stats right now" : "Sharing per your privacy toggles"}
            </div>
          </div>
        </div>
        <div className="flex bg-white/10 rounded-full p-1 shrink-0" role="radiogroup" aria-label="Sharing mode">
          {(["active", "silent"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => onChange(m)}
              className={`h-9 px-3.5 rounded-full text-[13px] font-semibold tracking-tight transition-all ${
                mode === m ? "bg-background text-foreground shadow" : "text-background/70"
              }`}
            >
              {m === "active" ? "Active" : "Silent"}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
