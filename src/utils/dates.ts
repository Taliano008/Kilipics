// Local calendar date as "YYYY-MM-DD". toISOString() gives the UTC date,
// which is still yesterday between midnight and 3am in Nairobi.
export function localIsoDate(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "YYYY-MM-DD" alone parses as UTC midnight; this anchors it to local
// midnight so day/week/month comparisons land on the day that was stored.
export function parseLocalDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}
