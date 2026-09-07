const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Matches "Mon-Sat 9:00-18:00" or single-day "Mon 9:00-18:00". Anything else
// (overnight hours where open >= close, unknown day abbreviations, extra
// tokens) is treated as unparseable — see computeOpenNow for why that means
// "closed", not "open".
const HOURS_PATTERN = /^(\w{3})(?:-(\w{3}))?\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;

function parseHours(hoursString) {
  const match = HOURS_PATTERN.exec(hoursString.trim());
  if (!match) return null;

  const [, startDay, endDayRaw, openH, openM, closeH, closeM] = match;
  const startIdx = WEEKDAYS.indexOf(startDay);
  const endIdx = WEEKDAYS.indexOf(endDayRaw || startDay);
  if (startIdx === -1 || endIdx === -1) return null;

  const openMinutes = Number(openH) * 60 + Number(openM);
  const closeMinutes = Number(closeH) * 60 + Number(closeM);
  if (openMinutes >= closeMinutes) return null;

  return { startIdx, endIdx, openMinutes, closeMinutes };
}

function isDayInRange(dayIdx, startIdx, endIdx) {
  // No wrap-around (e.g. "Sat-Mon") in Phase Zero — every real hours string
  // in the catalog runs Mon..Sun in order, and a wrapped range is more
  // likely a data-entry mistake than an intentional Sat-through-Mon week.
  if (startIdx > endIdx) return false;
  return dayIdx >= startIdx && dayIdx <= endIdx;
}

// Returns whether `hoursString` covers `now` (Africa/Nairobi wall time,
// UTC+3 year-round, no DST). Parsing is deliberately conservative: any
// ambiguous or unrecognized format returns false. A venue shown closed when
// it's actually open is a minor inconvenience; shown open when it's actually
// closed is a broken experience for someone who shows up.
export function computeOpenNow(hoursString, now = new Date()) {
  if (!hoursString) return false;

  const parsed = parseHours(hoursString);
  if (!parsed) return false;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  const dayIdx = WEEKDAYS.indexOf(weekday ?? "");
  if (dayIdx === -1 || Number.isNaN(hour) || Number.isNaN(minute)) return false;

  if (!isDayInRange(dayIdx, parsed.startIdx, parsed.endIdx)) return false;

  const nowMinutes = hour * 60 + minute;
  return nowMinutes >= parsed.openMinutes && nowMinutes < parsed.closeMinutes;
}
