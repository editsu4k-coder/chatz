import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/lib/profile-store";
import { Avatar } from "@/components/Avatar";
import {
  incomingRequests,
  acceptRequest,
  declineRequest,
  listFriends,
  outgoingRequestUids,
  friendUids,
  sendFriendRequest,
  type FriendRequest,
} from "@/lib/friends-repo";
import { searchProfiles, type PublicProfile } from "@/lib/profile-repo";
import { fetchPresenceMany, type Presence } from "@/lib/usage-repo";
import { isChatUnread, useChatsOverview, useReadMarkers } from "@/lib/dm-repo";
import { dismissNotifs, pushNotif } from "@/lib/notifications-store";
import { ChatZMark } from "@/components/Logo";
import { Search, UserPlus, Check, X, Users, RefreshCw, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/app/friends")({
  head: () => ({ meta: [{ title: "Friends · ChatZ" }] }),
  component: FriendsPage,
});

function FriendsPage() {
  const profile = useProfile();
  const [tab, setTab] = useState<"friends" | "find">("friends");

  if (!profile?.uid) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">
        Sign in to add friends and share screen-time stats.
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-20 glass-blur safe-top px-5 pt-2 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold tracking-tight">Friends</h1>
          <span
            className="rounded-[9px] overflow-hidden bg-foreground text-background flex"
            aria-hidden
          >
            <ChatZMark size={28} glyphOnly bg="transparent" fg="currentColor" />
          </span>
        </div>
        <div className="mt-3 inline-flex p-1 bg-secondary rounded-full text-[13px] font-medium w-full">
          {(["friends", "find"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-8 rounded-full capitalize transition ${
                tab === t ? "bg-surface shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "friends" ? "Friends" : "Find people"}
            </button>
          ))}
        </div>
      </header>

      <div className="px-3 pt-2 pb-8">
        {tab === "friends" ? (
          <FriendsTab myUid={profile.uid} />
        ) : (
          <FindTab myUid={profile.uid} />
        )}
      </div>
    </>
  );
}

/* ------------------------------- Friends tab ------------------------------ */
function FriendsTab({ myUid }: { myUid: string }) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [presence, setPresence] = useState<Map<string, Presence>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chats = useChatsOverview(myUid);
  const markers = useReadMarkers(myUid);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqs, fr] = await Promise.all([incomingRequests(myUid), listFriends(myUid)]);
      setRequests(reqs);
      setFriends(fr);
      // Presence is a bonus, never a reason to show the list as failed.
      const seen = await fetchPresenceMany(fr.map((f) => f.uid)).catch(
        () => new Map<string, Presence>(),
      );
      setPresence(seen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load friends");
    } finally {
      setLoading(false);
    }
  }, [myUid]);

  useEffect(() => {
    load();
  }, [load]);

  const onAccept = async (req: FriendRequest) => {
    setRequests((r) => r.filter((x) => x.id !== req.id));
    try {
      await acceptRequest(req, myUid);
      // Dismiss only after the accept stuck, so a failed accept leaves the
      // notification tappable.
      dismissNotifs((n) => n.kind === "friend_request" && n.fromUid === req.fromUid);
      const fr = await listFriends(myUid);
      setFriends(fr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept");
      load();
    }
  };

  const onDecline = async (req: FriendRequest) => {
    setRequests((r) => r.filter((x) => x.id !== req.id));
    try {
      await declineRequest(req);
      dismissNotifs((n) => n.kind === "friend_request" && n.fromUid === req.fromUid);
    } catch {
      load();
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[12px] uppercase tracking-wider text-muted-foreground font-medium">
          Activity
        </span>
        <button
          onClick={load}
          className="text-[12px] text-primary flex items-center gap-1 active:opacity-60"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && (
        <p className="text-[13px] text-destructive bg-destructive/10 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {requests.length > 0 && (
        <section className="space-y-2">
          <div className="text-[12px] uppercase tracking-wider text-muted-foreground font-medium px-1">
            Requests ({requests.length})
          </div>
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-2xl bg-surface border border-border p-3 flex items-center gap-3"
            >
              <Avatar
                name={req.fromName}
                color={req.fromColor}
                avatarId={req.fromAvatarId}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[15px] truncate">{req.fromName}</div>
                <div className="text-[12px] text-muted-foreground truncate">
                  @{req.fromHandle} wants to be your friend
                </div>
              </div>
              <button
                onClick={() => onAccept(req)}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground grid place-items-center active:scale-95"
                aria-label="Accept"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => onDecline(req)}
                className="w-9 h-9 rounded-full bg-secondary grid place-items-center active:scale-95"
                aria-label="Decline"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <div className="text-[12px] uppercase tracking-wider text-muted-foreground font-medium px-1 flex items-center gap-1.5">
          <Users size={13} /> Your friends ({friends.length})
        </div>
        {loading && friends.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">Loading…</p>
        ) : friends.length === 0 ? (
          <div className="text-center py-12 px-6">
            <UserPlus size={28} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No friends yet. Use <b>Find people</b> to search a handle and send a request.
            </p>
          </div>
        ) : (
          friends.map((f) => {
            const unread = isChatUnread(chats.get(f.uid), markers);
            const isOnline = presence.get(f.uid)?.online ?? false;
            return { friend: f, unread, isOnline };
          })
          // Sort: online users first, then alphabetically
          .sort((a, b) => {
            if (a.isOnline === b.isOnline) {
              return a.friend.name.localeCompare(b.friend.name);
            }
            return a.isOnline ? -1 : 1;
          })
          .map(({ friend, unread, isOnline }) => (
            <div
              key={friend.uid}
              className="rounded-2xl bg-surface border border-border p-3 flex items-center gap-3"
            >
              <button
                onClick={() => navigate({ to: "/app/user/$friendId", params: { friendId: friend.uid } })}
                className="flex-1 min-w-0 flex items-center gap-3 text-left active:scale-[0.99]"
              >
                <span className="relative shrink-0">
                  <Avatar name={friend.name} color={friend.color} avatarId={friend.avatarId} frame={friend.frame} size="md" />
                  {isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-surface" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-[15px] truncate">{friend.name}</span>
                  <span className="block text-[12px] text-muted-foreground truncate">
                    @{friend.handle}
                  </span>
                </span>
              </button>
              <button
                onClick={() => navigate({ to: "/app/chats/$chatId", params: { chatId: friend.uid } })}
                className="relative w-9 h-9 rounded-full bg-secondary grid place-items-center active:scale-95 shrink-0"
                aria-label={`Message ${friend.name}`}
              >
                <MessageCircle size={16} />
                {unread && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary ring-2 ring-surface" />
                )}
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

/* --------------------------------- Find tab -------------------------------- */
function FindTab({ myUid }: { myUid: string }) {
  const profile = useProfile();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [alreadyFriends, setAlreadyFriends] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Load relationship state once so result buttons show the right label.
  useEffect(() => {
    (async () => {
      try {
        const [sent, friends] = await Promise.all([outgoingRequestUids(myUid), friendUids(myUid)]);
        setRequested(sent);
        setAlreadyFriends(friends);
      } catch {
        /* non-fatal */
      }
    })();
  }, [myUid]);

  // Debounced search.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        setResults(await searchProfiles(query, myUid));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, myUid]);

  const onAdd = async (user: PublicProfile) => {
    try {
      // `created` is false when a request was already pending or you're already
      // friends — notify exactly once, only for a genuinely new request.
      const created = await sendFriendRequest(myUid, user.uid);
      if (created) {
        setRequested((s) => new Set(s).add(user.uid));
        if (profile) {
          pushNotif({
            toUid: user.uid,
            kind: "friend_request",
            fromName: profile.name,
            fromColor: profile.color,
            fromHandle: profile.handle,
            fromAvatarId: profile.avatarId,
            text: "sent you a friend request",
            link: "/app/friends",
          });
        }
        return;
      }
      // A no-op means this row's label was stale — refresh the real state
      // instead of optimistically claiming a request went out.
      const [sent, friends] = await Promise.all([outgoingRequestUids(myUid), friendUids(myUid)]);
      setRequested(sent);
      setAlreadyFriends(friends);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send request");
    }
  };

  return (
    <div className="space-y-3">
      <div className="h-11 rounded-xl bg-secondary px-3 flex items-center gap-2">
        <Search size={16} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by @handle or name"
          className="flex-1 bg-transparent outline-none text-[15px]"
        />
        {searching && <RefreshCw size={14} className="text-muted-foreground animate-spin" />}
      </div>

      {error && (
        <p className="text-[13px] text-destructive bg-destructive/10 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {q.trim().length === 0 ? (
        <p className="text-[13px] text-muted-foreground px-2 py-6 text-center">
          Find anyone by their @handle. Send a request — once they accept, you'll both see each
          other's real screen-time stats.
        </p>
      ) : results.length === 0 && !searching ? (
        <p className="text-center text-muted-foreground py-10 text-sm">
          No user matches "{q}". Try their exact @handle.
        </p>
      ) : (
        <ul className="space-y-2">
          {results.map((u) => {
            const isFriend = alreadyFriends.has(u.uid);
            const isRequested = requested.has(u.uid);
            return (
              <li
                key={u.uid}
                className="rounded-2xl bg-surface border border-border p-3 flex items-center gap-3"
              >
                <Avatar name={u.name} color={u.color} avatarId={u.avatarId} frame={u.frame} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px] truncate">{u.name}</div>
                  <div className="text-[12px] text-muted-foreground truncate">@{u.handle}</div>
                </div>
                {isFriend ? (
                  <span className="h-8 px-3 rounded-full bg-secondary text-[13px] font-medium grid place-items-center text-muted-foreground">
                    Friends
                  </span>
                ) : isRequested ? (
                  <span className="h-8 px-3 rounded-full bg-secondary text-[13px] font-medium grid place-items-center text-muted-foreground">
                    Requested
                  </span>
                ) : (
                  <button
                    onClick={() => onAdd(u)}
                    className="h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-[13px] font-medium active:scale-95 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <UserPlus size={14} className="shrink-0" /> Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
