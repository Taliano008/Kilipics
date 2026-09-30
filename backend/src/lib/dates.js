// Every TIMESTAMP column stores UTC wall-clock time, and db/connection.js
// hands it back as a plain "YYYY-MM-DD HH:MM:SS.mmm" string with no offset.
// `new Date(...)` on that string parses it as *local* time, not UTC. Always
// go through this to get a Date that means what the column actually means.
// Today's calendar date, "YYYY-MM-DD", where the businesses are. The server
// runs in UTC, which is still "yesterday" in Nairobi between midnight and
// 3am — and every listed business is in Kenya.
export const BUSINESS_TIME_ZONE = "Africa/Nairobi";
export function businessToday(now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseDbDateTime(value) {
  if (value == null) return null;
  return new Date(`${value.replace(" ", "T")}Z`);
}
