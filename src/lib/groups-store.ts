// Persistent groups store (localStorage). Starts EMPTY — only groups the
// user actually creates appear here. Supports create, add/remove member, mute, leave.
import { useEffect, useState } from "react";
import { readProfile } from "@/lib/profile-store";

export type GroupMember = { id: string; name: string; color: string; role?: string };
export type Group = {
  id: string;
  name: string;
  color: string;
  emoji: string;
  members: GroupMember[];
  muted?: boolean;
  left?: boolean;
};

const EVT = "chatz:groups:v2";

/** Per-account storage key: two logins on one device must never blend groups. */
function key(): string {
  return `chatz:groups:v2:${readProfile()?.uid ?? "anon"}`;
}

function read(): Group[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key());
    return raw ? (JSON.parse(raw) as Group[]) : [];
  } catch {
    return [];
  }
}

function write(list: Group[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(), JSON.stringify(list));
  window.dispatchEvent(new Event(EVT));
}

export function getGroups(): Group[] {
  return read().filter((g) => !g.left);
}
export function getGroup(id: string): Group | undefined {
  return read().find((g) => g.id === id);
}

export function createGroup(g: Omit<Group, "id">): Group {
  const list = read();
  const id = `g${Date.now()}`;
  const next: Group = { ...g, id };
  write([next, ...list]);
  return next;
}

export function updateGroup(id: string, patch: Partial<Group>) {
  write(read().map((g) => (g.id === id ? { ...g, ...patch } : g)));
}

export function addMember(id: string, m: GroupMember) {
  const list = read();
  const g = list.find((x) => x.id === id);
  if (!g) return;
  if (g.members.find((mm) => mm.id === m.id)) return;
  updateGroup(id, { members: [...g.members, m] });
}

export function removeMember(id: string, memberId: string) {
  const list = read();
  const g = list.find((x) => x.id === id);
  if (!g) return;
  updateGroup(id, { members: g.members.filter((m) => m.id !== memberId) });
}

export function useGroups() {
  const [list, setList] = useState<Group[]>(() => getGroups());
  useEffect(() => {
    const refresh = () => setList(getGroups());
    refresh();
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
}

export function useGroup(id: string) {
  const [g, setG] = useState<Group | undefined>(() => getGroup(id));
  useEffect(() => {
    const refresh = () => setG(getGroup(id));
    refresh();
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [id]);
  return g;
}
