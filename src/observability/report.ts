// Local, dependency-free failure reporting. This is the single seam meant to
// be swapped for a real crash-reporting SDK (e.g. Sentry) later — every call
// site in the app should go through here instead of a silent catch {} or an
// ad hoc console.error, so that swap only ever touches this one file.

export type ReportSeverity = "info" | "warning" | "error";

function normalize(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function log(severity: ReportSeverity, message: string, context?: Record<string, unknown>) {
  const line = context ? `[${severity}] ${message} ${JSON.stringify(context)}` : `[${severity}] ${message}`;
  if (severity === "error") console.error(line);
  else if (severity === "warning") console.warn(line);
  else console.log(line);
}

export function report(error: unknown, context?: Record<string, unknown>, severity: ReportSeverity = "error") {
  const { message, stack } = normalize(error);
  log(severity, message, stack ? { ...context, stack } : context);
}

export function reportMessage(message: string, context?: Record<string, unknown>, severity: ReportSeverity = "info") {
  log(severity, message, context);
}
