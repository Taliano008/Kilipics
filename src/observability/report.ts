import * as Sentry from "@sentry/react-native";

// This is the single seam every failure path in the app goes through
// instead of a silent catch {} or an ad hoc console.error — it forwards to
// Sentry (wired via app/_layout.tsx's Sentry.init) as well as logging
// locally, so behaviour is inspectable even when a Sentry event doesn't land.

export type ReportSeverity = "info" | "warning" | "error";

function normalize(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error)
    return { message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function log(
  severity: ReportSeverity,
  message: string,
  context?: Record<string, unknown>,
) {
  const line = context
    ? `[${severity}] ${message} ${JSON.stringify(context)}`
    : `[${severity}] ${message}`;
  if (severity === "error") console.error(line);
  else if (severity === "warning") console.warn(line);
  else console.log(line);
}

export function report(
  error: unknown,
  context?: Record<string, unknown>,
  severity: ReportSeverity = "error",
) {
  const { message, stack } = normalize(error);
  log(severity, message, stack ? { ...context, stack } : context);
  Sentry.captureException(error instanceof Error ? error : new Error(message), {
    level:
      severity === "error"
        ? "error"
        : severity === "warning"
          ? "warning"
          : "info",
    extra: context,
  });
}

export function reportMessage(
  message: string,
  context?: Record<string, unknown>,
  severity: ReportSeverity = "info",
) {
  log(severity, message, context);
  Sentry.captureMessage(message, {
    level:
      severity === "error"
        ? "error"
        : severity === "warning"
          ? "warning"
          : "info",
    extra: context,
  });
}
