// Persistent chat-message store (localStorage).
// Starts EMPTY — only messages actually sent from this device are stored here.
// No demo/seed conversations exist.
import { useEffect, useState } from "react";
import { readProfile } from "@/lib/profile-store";

export type Message = {
  id: string;
  author: string;
  color?: string;
  text: string;
  time: string;
  mine: boolean;
};

const EVT = "chatz:msgs:v2";

/** Per-account storage key: two logins on one device must never blend chats. */
function key(): string {
  return `chatz:msgs:v2:${readProfile()?.uid ?? "anon"}`;
}

function readMap(): Record<string, Message[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key());
    return raw ? (JSON.parse(raw) as Record<string, Message[]>) : {};
  } catch {
    return {};
  }
}

function writeMap(m: Record<string, Message[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(), JSON.stringify(m));
  window.dispatchEvent(new Event(EVT));
}

export function getMessages(chatId: string): Message[] {
  return readMap()[chatId] ?? [];
}

export function appendMessage(chatId: string, msg: Message) {
  const m = readMap();
  m[chatId] = [...(m[chatId] ?? []), msg];
  writeMap(m);
}

export function useChatMessages(chatId: string) {
  const [list, setList] = useState<Message[]>(() => getMessages(chatId));
  useEffect(() => {
    const refresh = () => setList(getMessages(chatId));
    refresh();
    window.addEventListener(EVT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [chatId]);
  return list;
}
