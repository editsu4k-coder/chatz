import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useProfile, colorForHandle } from "@/lib/profile-store";
import { Avatar } from "@/components/Avatar";
import { VibeStats, type VibeStatsData } from "@/lib/vibe-stats";
import { Capacitor } from "@capacitor/core";
import { getPublicProfile } from "@/lib/profile-repo";
import {
  ALL_SHARED,
  fetchUsageStats,
  fetchUsageStatsFresh,
  localDay,
  subscribeUsageStats,
  fetchPresence,
  type UsageStats,
  type Presence,
} from "@/lib/usage-repo";
import { fetchBlockState, type BlockState } from "@/lib/blocks-repo";
import {
  ChevronLeft,
  Wifi,
  Signal,
  Battery,
  Clock,
  BarChart3,
  Bell,
  Rocket,
  Smartphone,
  EyeOff,
  PauseCircle,
  CloudOff,
  Ban,
  RefreshCw,
} from "lucide-react";
import { StatSocial } from "@/components/StatSocial";
import {
  CollapsibleCard,
  StatCard,
  AppIcon,
  formatBytes,
  formatMinutes,
  formatMs,
  relTime,
} from "@/components/stat-ui";
import { ChatZMark } from "@/components/Logo";

export const Route = createFileRoute("/app/stats/$friendId")({
  head: () => ({ meta: [{ title: "Stats · ChatZ" }] }),
  component: StatsDetail,
});

function StatsDetail() {
  const { friendId } = Route.useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const isMe = friendId === "me" || friendId === profile?.uid;
  const myUid = profile?.uid ?? "";

  const [name, setName] = useState("…");
  const [handle, setHandle] = useState("");
  const [color, setColor] = useState("#5E72E4");
  const [avatarId, setAvatarId] = useState<string | undefined>(undefined);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);
  const [block, setBlock] = useState<BlockState>({ blockedByMe: false, blockedByThem: false });
  const [presence, setPresence] = useState<Presence | null>(null);

  useEffect(() => {
    let cancelled = false;
    let offStats: (() => void) | undefined;

    async function load() {
      setLoading(true);
      setError(null);
      setNoAccess(false);
      setBlock({ blockedByMe: false, blockedByThem: false });
      try {
        if (isMe && profile) {
          if (!cancelled) {
            setName(profile.name);
            setHandle(profile.handle);
            setColor(profile.color);
            setAvatarId(profile.avatarId);
          }
          // Prefer live on-device stats for my own profile — but only when Usage
          // access is granted; without it the collector would report a fake zero.
          if (Capacitor.isNativePlatform()) {
            const { granted } = await VibeStats.checkUsageAccess();
            if (cancelled) return;
            if (!granted) {
              setNoAccess(true);
              setStats(null);
              return;
            }
            const live = await VibeStats.collectStats();
            if (!cancelled) setStats(fromLive(live));
          } else {
            const remote = profile.uid ? await fetchUsageStats(profile.uid) : null;
            if (!cancelled) setStats(remote);
          }
        } else {
          // A blocked pair cannot read each other's profile or stats — the rules
          // deny both — so check first and render the blocked state rather than
          // surfacing a permission error.
          if (myUid) {
            const bs = await fetchBlockState(myUid, friendId);
            if (cancelled) return;
            if (bs.blockedByMe || bs.blockedByThem) {
              setBlock(bs);
              return;
            }
          }
          const user = await getPublicProfile(friendId);
          if (cancelled) return;
          if (user) {
            setName(user.name);
            setHandle(user.handle);
            setColor(user.color);
            setAvatarId(user.avatarId);
          } else {
            setName("Unknown");
            setColor(colorForHandle(friendId));
          }
          const remote = await fetchUsageStats(friendId);
          if (cancelled) return;
          setStats(remote);
          // Live: the moment this friend's device pushes a snapshot it replaces
          // what we show — no re-login or manual refresh needed.
          offStats = subscribeUsageStats(friendId, (s) => {
            if (!cancelled) setStats(s);
          });
          // Fetch presence to show accurate online/offline status
          const p = await fetchPresence(friendId).catch(() => null);
          if (!cancelled) setPresence(p);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      offStats?.();
    };
  }, [friendId, isMe, profile]);

  // Manual refresh: bypass the cache and pull the snapshot as it stands right
  // now — the sharing mode comes with it, so a friend who just went Silent
  // flips this page to the paused state on the spot.
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (isMe) {
        if (Capacitor.isNativePlatform()) {
          const { granted } = await VibeStats.checkUsageAccess();
          if (!granted) {
            setNoAccess(true);
            setStats(null);
          } else {
            setNoAccess(false);
            setStats(fromLive(await VibeStats.collectStats()));
          }
        } else if (profile?.uid) setStats(await fetchUsageStatsFresh(profile.uid));
      } else {
        setStats(await fetchUsageStatsFresh(friendId));
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setRefreshing(false);
    }
  };

  const screenMinutes = stats ? Math.round(stats.screenTimeTodayMs / 60000) : 0;
  // A snapshot from an earlier day holds no numbers for today — say so instead
  // of rendering the zeros.
  const freshToday = stats !== null && stats.day === localDay();
  // The sharing flags govern what friends can see; the owner's own view is never
  // gated by them. An absent `shared` map means an older client wrote the doc,
  // so treat every field as shared — the behaviour before the flags existed.
  const sh = isMe ? ALL_SHARED : (stats?.shared ?? ALL_SHARED);
  const ownerUid = isMe ? profile?.uid : friendId;
  // Silent wins over everything: the owner paused sharing, so a friend must not
  // see even an older active snapshot's numbers.
  const silent = !isMe && stats?.mode === "silent";
  const anyDeviceStat =
    sh.screenTime || sh.battery || sh.dataUsage || sh.notifications || sh.launches;
  const blocked = block.blockedByMe || block.blockedByThem;

  if (blocked) {
    return (
      <>
        <header className="sticky top-0 z-20 glass-blur safe-top px-3 pt-2 pb-2 flex items-center gap-2 border-b border-border">
          <button
            onClick={() => navigate({ to: "/app/friends" })}
            className="text-primary p-2 -ml-1 flex items-center"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 text-center text-[13px] font-medium text-muted-foreground">
            Stats
          </div>
          <span className="w-9 flex justify-end">
            <span
              className="w-6 h-6 rounded-[7px] overflow-hidden bg-foreground text-background flex shrink-0"
              aria-hidden
            >
              <ChatZMark size={24} glyphOnly bg="transparent" fg="currentColor" />
            </span>
          </span>
        </header>
        <div className="px-4 pt-5">
          <section className="rounded-3xl bg-surface border border-border/60 p-6 text-center">
            <Ban size={24} className="mx-auto text-muted-foreground mb-2" />
            {block.blockedByMe ? (
              <>
                <p className="text-[14px] font-medium">You blocked this person</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  You can't see their stats while they're blocked. Unblock them from their profile
                  first.
                </p>
                <Link
                  to="/app/user/$friendId"
                  params={{ friendId }}
                  className="mt-4 inline-flex h-10 px-4 rounded-2xl bg-secondary text-[13px] font-medium items-center active:scale-95"
                >
                  Go to profile
                </Link>
              </>
            ) : (
              <>
                <p className="text-[14px] font-medium">Stats unavailable</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  You can no longer view this person's stats because this user blocked you.
                </p>
              </>
            )}
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-20 glass-blur safe-top px-3 pt-2 pb-2 flex items-center gap-2 border-b border-border">
        <button
          onClick={() => navigate({ to: "/app/friends" })}
          className="text-primary p-2 -ml-1 flex items-center"
          aria-label="Back"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Avatar name={name} color={color} avatarId={avatarId} size="sm" />
          <div className="min-w-0">
            <div className="font-semibold text-[15px] truncate">{name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {handle ? `@${handle}` : "Activity"}
            </div>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="w-9 h-9 rounded-full bg-secondary grid place-items-center shrink-0 active:scale-95 transition disabled:opacity-60"
          aria-label="Refresh stats"
        >
          {refreshing ? (
            <span
              className="w-3.5 h-3.5 rounded-full border-2 border-primary/25 border-t-primary animate-spin"
              role="status"
              aria-label="Refreshing"
            />
          ) : (
            <RefreshCw size={15} />
          )}
        </button>
        <span
          className="w-6 h-6 rounded-[7px] overflow-hidden bg-foreground text-background flex shrink-0"
          aria-hidden
        >
          <ChatZMark size={24} glyphOnly bg="transparent" fg="currentColor" />
        </span>
      </header>

      <div className="px-4 pt-4 pb-8 space-y-4">
        {error && (
          <div className="rounded-3xl bg-destructive/10 border border-destructive/30 p-5 text-center">
            <p className="text-[13px] text-destructive">{error}</p>
          </div>
        )}

        {/* Silent: a friend sees only the paused notice — no numbers, no gradient. */}
        {silent ? (
          <section className="rounded-3xl bg-surface border border-border/60 p-6 text-center">
            <PauseCircle size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-[14px] font-medium">Stats sharing is paused</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              {name} turned on Silent mode. Nothing is shared until they switch back to Active.
            </p>
          </section>
        ) : stats?.blocked && !isMe ? (
          /* Active but not collecting (e.g. usage access lost after an update) —
             never render that as "they hid their stats". */
          <section className="rounded-3xl bg-surface border border-border/60 p-6 text-center">
            <CloudOff size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-[14px] font-medium">Not syncing right now</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              {name}'s phone isn't sending stats at the moment — their sharing settings haven't
              changed. Numbers return on the next sync.
            </p>
          </section>
        ) : (
          <>
            {(loading || stats) && (
              <section className="rounded-3xl p-5 bg-gradient-to-br from-primary to-[oklch(0.55_0.2_260)] text-primary-foreground">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs opacity-80 uppercase tracking-wider">
                    Screen time · today
                  </div>
                  {!isMe && (
                    <span className="text-[10px] uppercase tracking-wider opacity-80 flex items-center gap-1.5 shrink-0">
                      {presence?.online ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                          Online
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          Offline
                        </>
                      )}
                    </span>
                  )}
                </div>
                {loading ? (
                  <div className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">
                    <span className="opacity-60">…</span>
                  </div>
                ) : !sh.screenTime ? (
                  <>
                    <div className="mt-1.5 flex items-center gap-2 text-[22px] font-semibold tracking-tight">
                      <EyeOff size={19} className="opacity-90" /> Not shared
                    </div>
                    <div className="mt-1 text-[12px] opacity-80">
                      Screen time isn't shared with friends.
                    </div>
                  </>
                ) : !freshToday ? (
                  <>
                    <div className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">
                      <span className="text-3xl opacity-90">Waiting…</span>
                    </div>
                    <div className="mt-1 text-[12px] opacity-80">Waiting for today's sync</div>
                  </>
                ) : (
                  <div className="mt-1 text-5xl font-semibold tabular-nums tracking-tight">
                    {Math.floor(screenMinutes / 60)}h{" "}
                    <span className="opacity-80">{screenMinutes % 60}m</span>
                  </div>
                )}
                {stats?.deviceModel && sh.deviceInfo && (
                  <div className="mt-2 text-[12px] opacity-90 flex items-center gap-1.5">
                    <Smartphone size={13} /> {stats.deviceModel}
                    {stats.androidVersion ? ` · ${stats.androidVersion}` : ""}
                  </div>
                )}
                {stats?.syncedAt && (
                  <div className="mt-1 text-[11px] opacity-70">
                    Last update{" "}
                    {new Date(stats.syncedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    ({relTime(stats.syncedAt)})
                  </div>
                )}
                {stats && ownerUid && (
                  <StatSocial ownerUid={ownerUid} day={stats.day ?? localDay()} isSelf={isMe} />
                )}
              </section>
            )}

            {!loading && !stats && !error && noAccess && isMe && (
              <div className="rounded-3xl bg-surface border border-border p-6 text-center">
                <EyeOff size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-[14px] font-medium">No screen-time access</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Grant Usage access so ChatZ can show your real numbers — never a zero.
                </p>
                <Link
                  to="/app/settings/permissions"
                  className="mt-4 inline-flex h-10 px-4 rounded-2xl bg-primary text-primary-foreground text-[13px] font-medium items-center active:scale-95"
                >
                  Grant access
                </Link>
              </div>
            )}

            {!loading && !stats && !error && !noAccess && (
              <div className="rounded-3xl bg-surface border border-border p-6 text-center">
                <Smartphone size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-[14px] font-medium">No stats yet</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {isMe
                    ? "Grant Screen-time access and sync to see your stats here."
                    : "This person hasn't synced any screen-time data yet."}
                </p>
              </div>
            )}

            {stats && anyDeviceStat && (
              <CollapsibleCard
                title="Device stats"
                icon={<BarChart3 size={14} />}
                right={
                  sh.screenTime && freshToday ? (
                    <span className="text-[12px] text-muted-foreground tabular-nums">
                      {formatMinutes(screenMinutes)}
                    </span>
                  ) : null
                }
              >
                {!freshToday ? (
                  <p className="text-[13px] text-muted-foreground px-0.5">
                    {isMe
                      ? "Sync your device to see today's stats."
                      : `No details from today yet — they appear after ${name}'s next sync.`}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {sh.screenTime && (
                      <StatCard
                        icon={<Clock size={16} />}
                        label="Screen time"
                        value={formatMinutes(screenMinutes)}
                      />
                    )}
                    {sh.battery && (
                      <StatCard
                        icon={<Battery size={16} />}
                        label="Battery"
                        value={`${stats.batteryPercent}%${stats.isCharging ? " ⚡" : ""}`}
                      />
                    )}
                    {sh.dataUsage && (
                      <StatCard
                        icon={<Wifi size={16} />}
                        label="Wi-Fi data"
                        value={formatBytes(stats.wifiDataUsedBytes)}
                      />
                    )}
                    {sh.dataUsage && (
                      <StatCard
                        icon={<Signal size={16} />}
                        label="Mobile data"
                        value={formatBytes(stats.mobileDataUsedBytes)}
                      />
                    )}
                    {sh.notifications && (
                      <StatCard
                        icon={<Bell size={16} />}
                        label="Notifications"
                        value={String(stats.notificationCount)}
                      />
                    )}
                    {sh.launches && (
                      <StatCard
                        icon={<Rocket size={16} />}
                        label="App launches"
                        value={String(stats.launchCount)}
                      />
                    )}
                  </div>
                )}
              </CollapsibleCard>
            )}

            {stats && freshToday && sh.topApps && stats.topApps.length > 0 && (
              <CollapsibleCard
                title="Most used apps"
                right={
                  <span className="text-[12px] text-muted-foreground">
                    {stats.topApps.length} apps
                  </span>
                }
              >
                <ul className="space-y-3">
                  {stats.topApps.slice(0, 10).map((app) => {
                    const pct =
                      stats.screenTimeTodayMs > 0
                        ? (app.usageMs / stats.screenTimeTodayMs) * 100
                        : 0;
                    return (
                      <li key={app.packageName || app.appName} className="flex items-center gap-3">
                        <AppIcon name={app.appName || app.packageName} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[14px] font-medium truncate">
                              {app.appName || app.packageName}
                            </span>
                            <span className="text-[12px] text-muted-foreground tabular-nums shrink-0">
                              {formatMs(app.usageMs)}
                              {pct >= 1 && (
                                <span className="opacity-60"> · {Math.round(pct)}%</span>
                              )}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleCard>
            )}

            {stats &&
              freshToday &&
              sh.wifi &&
              (stats.isOnWifi || stats.isOnMobile || stats.maskedSsid) && (
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground px-1">
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
                    <span className="flex items-center gap-1 truncate">
                      <Smartphone size={12} /> {stats.maskedSsid}
                    </span>
                  )}
                </div>
              )}
          </>
        )}
      </div>
    </>
  );
}

function friendlyError(e: unknown): string {
  const code =
    typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
  if (code === "permission-denied") return "You need to be friends to see this person's stats.";
  if (code === "unavailable" || code === "deadline-exceeded") return "No connection. Try again.";
  return e instanceof Error ? e.message : "Failed to load stats";
}

function fromLive(live: VibeStatsData): UsageStats {
  return {
    uid: live.uid,
    day: localDay(),
    syncedAt: new Date().toISOString(),
    mode: "active",
    blocked: false,
    // Live device data is the owner's own view, so show it in full.
    shared: ALL_SHARED,
    screenTimeTodayMs: live.screenTimeTodayMs,
    launchCount: live.launchCount,
    notificationCount: live.notificationCount,
    deviceModel: live.deviceModel,
    androidVersion: live.androidVersion,
    topApps: live.topApps.map((a) => ({
      packageName: a.packageName,
      appName: a.appName,
      usageMs: a.usageMs,
    })),
    wifiDataUsedBytes: live.wifiDataUsedBytes,
    mobileDataUsedBytes: live.mobileDataUsedBytes,
    isOnWifi: live.isOnWifi,
    isOnMobile: live.isOnMobile,
    maskedSsid: live.maskedSsid,
    batteryPercent: live.batteryPercent,
    isCharging: live.isCharging,
  };
}

