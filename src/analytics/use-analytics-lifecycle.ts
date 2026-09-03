import { flush } from "@/analytics/queue";
import { useEffect } from "react";
import { AppState } from "react-native";

const FLUSH_INTERVAL_MS = 30_000;

// Flushes the queued analytics buffer on a timer and when the app is
// backgrounded. Kept out of events.ts/queue.ts so those stay plain modules
// with no React lifecycle concerns of their own.
export function useAnalyticsLifecycle() {
  useEffect(() => {
    const interval = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") void flush();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
}
