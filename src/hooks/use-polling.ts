"use client";

/**
 * usePolling — shared polling hook to avoid multiple concurrent timers.
 * Uses a single interval for multiple data fetchers.
 */
import { useEffect, useRef } from "react";

const POLLING_REGISTRY = new Map<
  string,
  { callback: () => void; intervalMs: number; lastRun: number }
>();

let globalTimer: ReturnType<typeof setInterval> | null = null;
let refCount = 0;

function startGlobalPoller() {
  if (globalTimer) return;
  globalTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of POLLING_REGISTRY) {
      if (now - entry.lastRun >= entry.intervalMs) {
        entry.lastRun = now;
        try { entry.callback(); } catch (e) { console.error(`[polling:${key}]`, e); }
      }
    }
  }, 5000);
}

function stopGlobalPoller() {
  if (globalTimer) { clearInterval(globalTimer); globalTimer = null; }
}

/**
 * Register a polling callback with deduplication.
 * Multiple components can poll the same key without duplicating requests.
 */
export function usePolling(
  key: string,
  callback: () => void,
  intervalMs: number = 30_000,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    POLLING_REGISTRY.set(key, {
      callback: () => callbackRef.current(),
      intervalMs,
      lastRun: 0,
    });

    refCount++;
    startGlobalPoller();

    return () => {
      POLLING_REGISTRY.delete(key);
      refCount--;
      if (refCount <= 0) {
        refCount = 0;
        stopGlobalPoller();
      }
    };
  }, [key, intervalMs, enabled]);
}
