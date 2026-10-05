import { describe, expect, it } from "vitest";

import { aggregateVisits, visitWindows } from "../backend/src/services/visit-stats.js";

const NAIROBI = 180;
// Thursday 15 October 2026, 14:30 in Nairobi (11:30 UTC).
const NOW = Date.UTC(2026, 9, 15, 11, 30);
// A local (Nairobi) wall-clock time as the "local ms" the module works in.
const local = (m: number, d: number, h = 10, min = 0) => Date.UTC(2026, m - 1, d, h, min);

type Event = { name: string; visitor: string; ts: number };
const view = (visitor: string, ts: number): Event => ({ name: "view", visitor, ts });

describe("visitWindows", () => {
  it("runs the week Monday to Sunday and compares the same days last week", () => {
    const w = visitWindows("week", NOW, NAIROBI);
    expect(w.curStart).toBe(local(10, 12, 0));
    expect(w.currentIndex).toBe(3); // Thursday
    expect(w.prevStart).toBe(local(10, 5, 0));
    expect(w.prevEnd).toBe(local(10, 8, 14, 30));
  });

  it("compares today with yesterday up to the same time", () => {
    const w = visitWindows("today", NOW, NAIROBI);
    expect(w.prevEnd).toBe(local(10, 14, 14, 30));
    expect(w.currentIndex).toBe(1); // afternoon
  });

  it("gives the month one bar per day and compares the same days last month", () => {
    const w = visitWindows("month", NOW, NAIROBI);
    expect(w.labels).toHaveLength(31);
    expect(w.labels.slice(0, 8)).toEqual(["1", "", "", "", "", "", "", "8"]);
    expect(w.prevStart).toBe(local(9, 1, 0));
    expect(w.prevEnd).toBe(local(9, 15, 14, 30));
  });

  it("clamps the comparison to the end of a shorter previous month", () => {
    const w = visitWindows("month", Date.UTC(2026, 2, 31, 9, 0), NAIROBI); // 31 March
    expect(w.prevEnd).toBe(Date.UTC(2026, 1, 28, 12, 0)); // 28 Feb, same time
  });
});

describe("aggregateVisits", () => {
  const w = visitWindows("week", NOW, NAIROBI);

  it("counts visits, people and actions in the current week only", () => {
    const events: Event[] = [
      view("a", local(10, 13)),
      view("a", local(10, 13, 11)),
      view("b", local(10, 15, 9)),
      view("c", local(10, 15, 16)), // later today: not happened yet
      view("z", local(10, 6)), // last week, within the comparison window
      { name: "contact", visitor: "a", ts: local(10, 13, 12) },
      { name: "contact", visitor: "a", ts: local(10, 14) },
      { name: "book", visitor: "b", ts: local(10, 15, 9) },
    ];
    const r = aggregateVisits(events, w);
    expect(r.visits).toBe(3);
    expect(r.people).toBe(2);
    expect(r.contacted).toBe(1);
    expect(r.bookTaps).toBe(1);
    expect(r.series.map((s: { value: number }) => s.value)).toEqual([0, 2, 0, 1, 0, 0, 0]);
    expect(r.comparison).toEqual({ delta: 2, percent: 200 });
  });

  it("has no comparison when the previous period had no visits", () => {
    expect(aggregateVisits([view("a", local(10, 13))], w).comparison).toBeNull();
  });
});
