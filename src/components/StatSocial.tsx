// Reactions + threaded comments on a day's screen-time card. Rendered inside
// the gradient hero of both stat pages, so chips use white-on-gradient styling.
//
// Data lives under statPosts/{ownerUid}_{day}/ (reactions + comments) — see
// lib/stat-social.ts for the schema. Only `setReaction` writes, only
// `addComment` writes comments; notifications go through the shared Firestore
// notifications store so they appear on the same bell/feed as everything else.
import { useEffect, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { relTime } from "@/components/stat-ui";
import { useProfile } from "@/lib/profile-store";
import { pushNotif } from "@/lib/notifications-store";
import {
  REACTIONS,
  addComment,
  glyphFor,
  loadCommentsPage,
  setReaction,
  subscribeComments,
  subscribeReactions,
  type ReactionKey,
  type ReactionSummary,
  type StatComment,
} from "@/lib/stat-social";

export function StatSocial({
  ownerUid,
  day,
  isSelf = false,
  compact = false,
  commentFirst = false,
  className = "mt-4",
}: {
  ownerUid: string;
  day: string;
  isSelf?: boolean;
  /** Chip styling for cards that sit on a normal surface instead of the hero gradient. */
  compact?: boolean;
  /** Put the comments button at the start of the row instead of the end. */
  commentFirst?: boolean;
  /** Spacing override for the chip row. */
  className?: string;
}) {
  const profile = useProfile();
  const myUid = profile?.uid;
  const [summary, setSummary] = useState<ReactionSummary>({ counts: {}, mine: null });
  const [comments, setComments] = useState<StatComment[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  // Live subscriptions: reactions and comments update for everyone the moment
  // they are written, so cards never show a stale summary until a re-login.
  useEffect(() => {
    if (!myUid) return;
    const offReactions = subscribeReactions(ownerUid, day, myUid, setSummary);
    const offComments = subscribeComments(ownerUid, day, setComments);
    return () => {
      offReactions();
      offComments();
    };
  }, [ownerUid, day, myUid]);

  const toggle = async (key: ReactionKey) => {
    if (isSelf || busy || !myUid || !profile) return;
    const prev = summary;
    const nextMine = summary.mine === key ? null : key;
    const counts = { ...summary.counts };
    if (summary.mine) counts[summary.mine] = Math.max(0, (counts[summary.mine] ?? 1) - 1);
    if (nextMine) counts[nextMine] = (counts[nextMine] ?? 0) + 1;
    setSummary({ counts, mine: nextMine });
    setBusy(true);
    try {
      await setReaction(ownerUid, day, myUid, nextMine);
      if (nextMine) {
        pushNotif({
          toUid: ownerUid,
          kind: "reaction",
          fromName: profile.name,
          fromColor: profile.color,
          fromHandle: profile.handle,
          fromAvatarId: profile.avatarId,
          text: `reacted ${glyphFor(nextMine)} to your screen time`,
          link: "/app",
        });
      }
    } catch {
      setSummary(prev);
    } finally {
      setBusy(false);
    }
  };

  const totalReactions = Object.values(summary.counts).reduce((a, b) => a + b, 0);

  const commentBtn = (
    <button
      onClick={() => setOpen(true)}
      className={`px-3 rounded-full text-[13px] flex items-center gap-1.5 active:scale-95 ${
        commentFirst ? "shrink-0" : "ml-auto"
      } ${compact ? "h-7 bg-secondary text-foreground" : "h-8 bg-white/15"}`}
      aria-label="Open comments"
    >
      <MessageCircle size={14} />
      {comments.length > 0 ? comments.length : ""}
    </button>
  );

  return (
    <>
      <div className={`flex items-center gap-1.5 flex-wrap ${className}`.trim()}>
        {commentFirst && commentBtn}
        {REACTIONS.map((r) => {
          const count = summary.counts[r.key] ?? 0;
          const mine = summary.mine === r.key;
          if (isSelf && count === 0) return null;
          if (isSelf) {
            return (
              <span
                key={r.key}
                className={`px-2.5 rounded-full text-[13px] flex items-center gap-1 tabular-nums ${
                  compact ? "h-7 bg-secondary text-muted-foreground" : "h-8 bg-white/15"
                }`}
                title={r.key}
              >
                {r.glyph} {count}
              </span>
            );
          }
          return (
            <button
              key={r.key}
              onClick={() => toggle(r.key)}
              disabled={busy}
              className={`px-2.5 rounded-full text-[13px] flex items-center gap-1 tabular-nums transition active:scale-95 ${
                compact
                  ? `h-7 ${mine ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary text-foreground"}`
                  : `h-8 ${mine ? "bg-white text-foreground font-semibold" : "bg-white/15"}`
              }`}
              title={r.key}
            >
              {r.glyph} {count > 0 ? count : ""}
            </button>
          );
        })}
        {isSelf && totalReactions === 0 && (
          <span className={`text-[12px] ${compact ? "text-muted-foreground" : "opacity-70"}`}>
            No reactions yet
          </span>
        )}
        {!commentFirst && commentBtn}
      </div>

      {open && (
        <CommentSheet
          ownerUid={ownerUid}
          day={day}
          isSelf={isSelf}
          comments={comments}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function excerpt(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

function CommentSheet({
  ownerUid,
  day,
  isSelf,
  comments: liveComments,
  onClose,
}: {
  ownerUid: string;
  day: string;
  isSelf: boolean;
  comments: StatComment[];
  onClose: () => void;
}) {
  const profile = useProfile();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<StatComment | null>(null);
  const [sending, setSending] = useState(false);
  const [lastSendAt, setLastSendAt] = useState(0);
  
  // Pagination state for initial load + infinite scroll
  const [pagedComments, setPagedComments] = useState<StatComment[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;

  // Initial page load when sheet opens
  useEffect(() => {
    if (!ownerUid || !day) return;
    setPagedComments([]);
    setHasMore(true);
    loadCommentsPage(ownerUid, day, PAGE_SIZE).then((page) => {
      setPagedComments(page);
      setHasMore(page.length === PAGE_SIZE);
    });
  }, [ownerUid, day]);

  // Merge live updates into paged comments (new comments from subscription)
  useEffect(() => {
    if (liveComments.length === 0) return;
    // Only add new comments that aren't already in pagedComments
    const existingIds = new Set(pagedComments.map((c) => c.id));
    const newOnes = liveComments.filter((c) => !existingIds.has(c.id));
    if (newOnes.length > 0) {
      setPagedComments((prev) => [...prev, ...newOnes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    }
  }, [liveComments]);

  const loadMore = async () => {
    if (loadingMore || !hasMore || pagedComments.length === 0) return;
    setLoadingMore(true);
    const oldest = pagedComments[0];
    const cursor = { id: oldest.id, createdAt: Date.parse(oldest.createdAt) };
    try {
      const older = await loadCommentsPage(ownerUid, day, PAGE_SIZE, cursor);
      if (older.length < PAGE_SIZE) setHasMore(false);
      setPagedComments((prev) => [...older, ...prev]);
    } finally {
      setLoadingMore(false);
    }
  };

  const allComments = pagedComments;

  const roots = allComments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => allComments.filter((c) => c.parentId === id);

  const MIN_COMMENT_INTERVAL = 2000; // 2s cooldown between comments

  const send = async () => {
    const text = draft.trim();
    if (!text || sending || !profile?.uid) return;
    const now = Date.now();
    // Enforce cooldown: prevent rapid-fire comment submissions
    if (now - lastSendAt < MIN_COMMENT_INTERVAL) return;
    setSending(true);
    setLastSendAt(now);
    try {
      await addComment(
        ownerUid,
        day,
        {
          uid: profile.uid,
          name: profile.name,
          handle: profile.handle ?? "",
          color: profile.color,
          avatarId: profile.avatarId,
        },
        text,
        replyTo ? (replyTo.parentId ?? replyTo.id) : null,
      );
      const base = {
        kind: "comment" as const,
        fromName: profile.name,
        fromColor: profile.color,
        fromHandle: profile.handle,
        fromAvatarId: profile.avatarId,
      };
      // The owner is already on this page when commenting, and pushNotif()
      // skips self-notifications anyway — only notify when someone else acts.
      if (!isSelf && profile.uid !== ownerUid) {
        pushNotif({
          ...base,
          toUid: ownerUid,
          text: replyTo ? `replied: "${excerpt(text)}"` : `commented: "${excerpt(text)}"`,
          link: "/app",
        });
      }
      if (replyTo && replyTo.authorUid !== ownerUid && replyTo.authorUid !== profile.uid) {
        pushNotif({
          ...base,
          toUid: replyTo.authorUid,
          text: `replied to your comment: "${excerpt(text)}"`,
          link: `/app/stats/${ownerUid}`,
        });
      }
      setDraft("");
      setReplyTo(null);
    } catch {
      /* keep the draft so the user can retry */
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/30"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-background text-foreground rounded-t-3xl safe-bottom animate-in slide-in-from-bottom duration-200 flex flex-col"
        style={{ maxHeight: "80vh" }}
      >
        <div className="px-5 pt-5 pb-2 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold tracking-tight">
            Comments {allComments.length > 0 && <span className="text-muted-foreground">· {allComments.length}</span>}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary grid place-items-center"
            aria-label="Close comments"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
          {hasMore && allComments.length > 0 && (
            <div className="flex justify-center py-2">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="text-[13px] text-primary font-medium disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load older comments"}
              </button>
            </div>
          )}
          {roots.length === 0 && !loadingMore && (
            <p className="text-center text-[13px] text-muted-foreground py-8">
              No comments yet. Say something nice.
            </p>
          )}
          {roots.map((c) => (
            <div key={c.id}>
              <CommentRow c={c} onReply={setReplyTo} />
              {repliesOf(c.id).length > 0 && (
                <div className="mt-3 ml-9 pl-3 border-l border-border space-y-3">
                  {repliesOf(c.id).map((r) => (
                    <CommentRow key={r.id} c={r} onReply={setReplyTo} small />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 pt-2 pb-3 border-t border-border shrink-0">
          {replyTo && (
            <div className="flex items-center gap-2 pb-2 text-[12px] text-muted-foreground">
              <span className="truncate">
                Replying to <span className="font-medium">{replyTo.authorName}</span>
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="ml-auto text-primary font-medium"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={replyTo ? `Reply to ${replyTo.authorName}…` : "Add a comment…"}
              maxLength={1000}
              className="flex-1 h-10 rounded-full bg-secondary px-4 text-[14px] text-foreground placeholder:text-muted-foreground caret-primary outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={send}
              disabled={!draft.trim() || sending || (Date.now() - lastSendAt < MIN_COMMENT_INTERVAL)}
              className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-40 active:scale-95 transition"
              aria-label="Send comment"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentRow({
  c,
  onReply,
  small = false,
}: {
  c: StatComment;
  onReply: (c: StatComment) => void;
  small?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <Avatar
        name={c.authorName}
        color={c.authorColor}
        avatarId={c.authorAvatarId}
        size={small ? "xs" : "sm"}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`font-medium truncate ${small ? "text-[12px]" : "text-[13px]"}`}>
            {c.authorName}
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0">{relTime(c.createdAt)}</span>
        </div>
        <p className={`${small ? "text-[12px]" : "text-[13px]"} whitespace-pre-wrap break-words`}>
          {c.text}
        </p>
        <button onClick={() => onReply(c)} className="mt-0.5 text-[11px] text-primary font-medium">
          Reply
        </button>
      </div>
    </div>
  );
}
