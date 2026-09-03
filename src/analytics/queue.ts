import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/config/env";
import { report } from "@/observability/report";

const QUEUE_KEY = "kilipicks.analytics.queue.v1";
const MAX_BUFFER = 500;
const FLUSH_THRESHOLD = 20;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60 * 1000;

export type QueuedEvent = Record<string, unknown> & { eventId: string };

let queue: QueuedEvent[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
let flushInFlight: Promise<void> | null = null;
let retryAttempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureLoaded() {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(QUEUE_KEY)
      .then((raw) => {
        queue = raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
      })
      .catch((reason) => {
        report(reason, { scope: "analytics_queue_load" });
        queue = [];
      })
      .finally(() => {
        loaded = true;
      });
  }
  await loadPromise;
}

function persist() {
  void AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(event: QueuedEvent) {
  await ensureLoaded();
  queue.push(event);
  if (queue.length > MAX_BUFFER) queue = queue.slice(queue.length - MAX_BUFFER);
  persist();
  // Skip while a backoff retry is already scheduled — the pending retry will
  // pick up everything queued so far (performFlush always sends the full
  // current queue), so this avoids hammering the network on every event
  // once the buffer is past the threshold during an outage.
  if (queue.length >= FLUSH_THRESHOLD && !retryTimer) void flush();
}

function scheduleRetry() {
  if (retryTimer) return;
  const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempt, RETRY_MAX_MS);
  const jitter = delay * (0.5 + Math.random() * 0.5);
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, jitter);
}

async function performFlush(): Promise<void> {
  await ensureLoaded();
  if (queue.length === 0) return;
  const batch = [...queue];
  try {
    const response = await fetch(`${API_BASE_URL}/api/analytics/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
    });
    if (!response.ok)
      throw new Error(`Analytics ingest failed (${response.status})`);
    const sentIds = new Set(batch.map((event) => event.eventId));
    queue = queue.filter((event) => !sentIds.has(event.eventId));
    persist();
    retryAttempt = 0;
  } catch (reason) {
    // Analytics must never block or crash the UI — keep the batch queued
    // and retry with backoff rather than dropping or discarding silently.
    report(
      reason,
      { scope: "analytics_flush", pending: queue.length },
      "warning",
    );
    scheduleRetry();
  }
}

export function flush(): Promise<void> {
  if (!flushInFlight) {
    flushInFlight = performFlush().finally(() => {
      flushInFlight = null;
    });
  }
  return flushInFlight;
}
