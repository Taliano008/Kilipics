// Street address → approximate coordinates, via OpenStreetMap's Nominatim.
// Used only when a merchant saves an address without placing a map pin, so
// volume is a handful of requests a day — well inside Nominatim's usage
// policy (max 1 request/second, identifying User-Agent, cache results; see
// https://operations.osmfoundation.org/policies/nominatim/). Results are
// stored on the business row, so each address is looked up once.

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 4000;

// Same bounds as the pin check in merchant-business.js.
function insideKenya(lat, lng) {
  return lat >= -5 && lat <= 5.5 && lng >= 33.5 && lng <= 42.5;
}

function userAgent() {
  const contact = process.env.GEOCODER_CONTACT_EMAIL;
  return contact ? `KiliPicks/1.0 (${contact})` : "KiliPicks/1.0";
}

// Unit numbers and the like never match anything in OpenStreetMap and only
// make the search fail ("Suite 22", "Room 202", "104").
const UNIT_PART = /\d|^(suite|room|unit|shop|floor|apt|apartment|house|stall|no\.?)\b/i;
// "Suite 297 Dennis Pritt" → "Dennis Pritt": a unit prefix glued to a street.
const UNIT_PREFIX = /^(suite|room|unit|shop|floor|apt|apartment|house|stall|no\.?)?\s*#?\d+[a-z]?\s+/i;
const CITY_PART = /^nairobi$/i;
const MAX_ATTEMPTS = 4;

// Candidate searches, most specific first: the address without unit parts
// ("Waiyaki Way, Muthiga"), then each remaining part alone, in the order the
// merchant wrote them — street names usually come first and locate best.
export function geocodeQueries(address) {
  const parts = String(address ?? "")
    .split(",")
    .map((p) => p.trim().replace(UNIT_PREFIX, "").replace(/\s+/g, " "))
    .filter((p) => p && !UNIT_PART.test(p) && !CITY_PART.test(p));
  const queries = [parts.join(", "), ...parts].filter(Boolean);
  return [...new Set(queries)].slice(0, MAX_ATTEMPTS);
}

// Returns { lat, lng } or null — never throws, so a geocoder outage can't
// block a merchant from saving their address.
export async function geocodeAddress(address) {
  const queries = geocodeQueries(address);
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 1100)); // 1 req/s policy
    const hit = await lookup(`${queries[i]}, Nairobi, Kenya`);
    if (hit) return hit;
  }
  return null;
}

async function lookup(query) {
  const url = `${NOMINATIM_URL}?${new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    countrycodes: "ke",
  })}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent(), Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const [first] = await res.json();
    if (!first) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) && insideKenya(lat, lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}
