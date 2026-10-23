"use client";
// sessionStorage as an external store: server and first client render both see null, so there is no hydration mismatch.
import { useSyncExternalStore } from "react";

const PREFIX = "ddd:";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(PREFIX + key);
    else sessionStorage.setItem(PREFIX + key, value);
  } catch {
    // Storage blocked (private mode): state just won't survive a reload.
  }
  notify();
}

// Clears this app's keys, except any listed in `keep` (e.g. the demo-prep cache).
export function clearSession(keep: string[] = []) {
  const kept = new Set(keep.map((k) => PREFIX + k));
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(PREFIX) && !kept.has(k))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // Storage blocked: nothing to clear.
  }
  notify();
}

export function useSessionValue(key: string): string | null {
  return useSyncExternalStore(subscribe, () => read(key), () => null);
}
