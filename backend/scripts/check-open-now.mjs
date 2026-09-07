import { computeOpenNow } from "../src/services/open-now.js";

// 2024-01-01 is a Monday. Nairobi is UTC+3 with no DST, so Nairobi wall time
// = UTC instant + 3h; these UTC instants are chosen to land on known Nairobi
// weekdays/times without depending on this machine's local timezone.
const MON_10AM = new Date("2024-01-01T07:00:00Z"); // Mon 10:00 Nairobi
const MON_8AM = new Date("2024-01-01T05:00:00Z"); // Mon 08:00 Nairobi
const MON_6PM_EXACT = new Date("2024-01-01T15:00:00Z"); // Mon 18:00 Nairobi
const SUN_10AM = new Date("2023-12-31T07:00:00Z"); // Sun 10:00 Nairobi

const cases = [
  ["Mon-Sat 9:00-18:00", MON_10AM, true, "within range on a covered day"],
  ["Mon-Sat 9:00-18:00", MON_8AM, false, "before opening"],
  ["Mon-Sat 9:00-18:00", MON_6PM_EXACT, false, "exactly at closing"],
  ["Mon-Sat 9:00-18:00", SUN_10AM, false, "day not in range"],
  ["Mon-Sun 8:00-20:00", SUN_10AM, true, "day in full-week range"],
  ["", MON_10AM, false, "empty hours string"],
  ["not a real schedule", MON_10AM, false, "unparseable string"],
  ["Xxx-Sat 9:00-18:00", MON_10AM, false, "unknown weekday abbreviation"],
  ["Mon-Sat 20:00-9:00", MON_10AM, false, "open >= close (overnight, unsupported)"],
];

let failures = 0;
for (const [hours, now, expected, label] of cases) {
  const actual = computeOpenNow(hours, now);
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}  (hours=${JSON.stringify(hours)} -> ${actual}, expected ${expected})`);
}

if (failures > 0) {
  console.error(`\n${failures}/${cases.length} case(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${cases.length} cases passed.`);
}
