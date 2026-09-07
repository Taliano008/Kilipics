// The DB pool sets `timezone: "Z"`, so every DATETIME column stores and
// returns UTC wall-clock time — but `dateStrings: true` hands it back as a
// plain "YYYY-MM-DD HH:MM:SS.mmm" string with no offset. `new Date(...)` on
// that string parses it as *local* time, not UTC. Always go through this to
// get a Date that means what the column actually means.
export function parseDbDateTime(value) {
  if (value == null) return null;
  return new Date(`${value.replace(" ", "T")}Z`);
}
