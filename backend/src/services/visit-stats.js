// Pure date/bucketing logic for the merchant "Store visits" card — no
// database access, so tests can exercise it directly.
//
// All windows are computed in the merchant's local time: "local ms" below is
// a UTC epoch shifted by the phone's offset, read back with getUTC* methods.

const DAY = 86_400_000;
const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const DAYPART_LABELS = ["Morning", "Afternoon", "Evening"];
export const RANGES = new Set(["today", "week", "month"]);

function startOfDay(localMs) {
  const d = new Date(localMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daypart(localMs) {
  const hour = new Date(localMs).getUTCHours();
  return hour < 12 ? 0 : hour < 17 ? 1 : 2;
}

// The current period so far, the same stretch of the previous period (for a
// like-for-like comparison), and how to bucket visits for the chart.
export function visitWindows(range, nowUtcMs, tzOffsetMin) {
  const now = nowUtcMs + tzOffsetMin * 60_000;
  const today = startOfDay(now);
  const sinceMidnight = now - today;
  const d = new Date(now);

  if (range === "today") {
    return {
      curStart: today,
      curEnd: now,
      prevStart: today - DAY,
      prevEnd: now - DAY,
      labels: DAYPART_LABELS,
      bucket: daypart,
      currentIndex: daypart(now),
    };
  }

  if (range === "week") {
    const sinceMonday = (d.getUTCDay() + 6) % 7; // Monday = 0
    const monday = today - sinceMonday * DAY;
    return {
      curStart: monday,
      curEnd: now,
      prevStart: monday - 7 * DAY,
      prevEnd: now - 7 * DAY,
      labels: WEEKDAY_LABELS,
      bucket: (ts) => Math.floor((ts - monday) / DAY),
      currentIndex: sinceMonday,
    };
  }

  // month: this calendar month so far vs the same days of last month.
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const date = d.getUTCDate();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const daysInPrev = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthStart = Date.UTC(y, m, 1);
  return {
    curStart: monthStart,
    curEnd: now,
    prevStart: Date.UTC(y, m - 1, 1),
    prevEnd: Date.UTC(y, m - 1, Math.min(date, daysInPrev)) + sinceMidnight,
    labels: Array.from({ length: daysInMonth }, (_, i) => (i % 7 === 0 ? String(i + 1) : "")),
    bucket: (ts) => new Date(ts).getUTCDate() - 1,
    currentIndex: date - 1,
  };
}

// events: { name, visitor, ts } with ts already in local ms. Views are
// counted per event; the other actions per distinct visitor.
export function aggregateVisits(events, windows) {
  const inCur = (e) => e.ts >= windows.curStart && e.ts <= windows.curEnd;
  const inPrev = (e) => e.ts >= windows.prevStart && e.ts <= windows.prevEnd;
  const people = (name) =>
    new Set(events.filter((e) => e.name === name && inCur(e)).map((e) => e.visitor)).size;

  const views = events.filter((e) => e.name === "view" && inCur(e));
  const series = windows.labels.map((label) => ({ label, value: 0 }));
  for (const v of views) {
    const i = windows.bucket(v.ts);
    if (series[i]) series[i].value++;
  }

  const visits = views.length;
  const visitors = new Set(views.map((v) => v.visitor)).size;
  const previousVisits = events.filter((e) => e.name === "view" && inPrev(e)).length;
  const comparison =
    previousVisits > 0
      ? {
          delta: visits - previousVisits,
          percent: Math.round(((visits - previousVisits) / previousVisits) * 100),
        }
      : null;

  return {
    visits,
    people: visitors,
    // Can't exceed the visitors shown beside it ("9 of 31 got in touch"),
    // even if someone viewed last week and called today.
    contacted: Math.min(people("contact"), visitors),
    bookTaps: people("book"),
    saves: people("save"),
    previousVisits,
    comparison,
    series,
    currentIndex: windows.currentIndex,
  };
}
