import { query, queryOne } from "../db/connection.js";
import { badRequest } from "../lib/http-errors.js";
import { RANGES, aggregateVisits, visitWindows } from "./visit-stats.js";

// Analytics event names → the actions the Store visits card shows.
// A tap on a listing card used to log its own merchant_profile_viewed on top
// of the store page's, double-counting every visit; those card events
// (source_section 'provider_card') are left out so old data counts right too.
const EVENT_KINDS = {
  merchant_profile_viewed: "view",
  contact_channel_clicked: "contact",
  booking_cta_clicked: "book",
  merchant_saved: "save",
};
const NAIROBI_OFFSET_MIN = 180;

// "YYYY-MM-DD HH:MM:SS.mmm" (UTC) → epoch ms.
function utcMs(timestamp) {
  return Date.parse(`${String(timestamp).replace(" ", "T")}Z`);
}

// UTC epoch ms → the "YYYY-MM-DD HH:MM:SS.mmm" form the timestamp columns use.
function toDbTimestamp(ms) {
  return new Date(ms).toISOString().replace("T", " ").replace("Z", "");
}

// A merchant's own business only. Visitor ids never leave the server — the
// card shows counts, not who visited.
export async function getStoreVisits(businessId, input = {}) {
  if (!businessId) {
    throw badRequest("business_required", "Finish setting up your business profile first.");
  }
  const range = RANGES.has(input.range) ? input.range : "week";
  const offset = Number.parseInt(input.tzOffset, 10);
  const tzOffsetMin = Number.isFinite(offset) && offset >= -720 && offset <= 840 ? offset : NAIROBI_OFFSET_MIN;
  // The merchant's own phone, so checking their listing doesn't pad the count.
  const exclude = typeof input.exclude === "string" ? input.exclude.slice(0, 100) : "";

  const windows = visitWindows(range, Date.now(), tzOffsetMin);
  const offsetMs = tzOffsetMin * 60_000;
  const rows = await query(
    `SELECT event_name, anonymous_user_id, "timestamp" FROM analytics_events
     WHERE merchant_id = ?
       AND event_name IN ('merchant_profile_viewed','contact_channel_clicked','booking_cta_clicked','merchant_saved')
       AND COALESCE(source_section, '') <> 'provider_card'
       AND anonymous_user_id <> ?
       AND "timestamp" >= ? AND "timestamp" <= ?`,
    [
      businessId,
      exclude,
      toDbTimestamp(windows.prevStart - offsetMs),
      toDbTimestamp(windows.curEnd - offsetMs),
    ],
  );

  const events = rows.map((r) => ({
    name: EVENT_KINDS[r.event_name],
    visitor: r.anonymous_user_id,
    ts: utcMs(r.timestamp) + offsetMs,
  }));

  // For the "No visits yet" state: has this store ever had a visit?
  const lifetime = await queryOne(
    `SELECT COUNT(*) AS n FROM analytics_events
     WHERE merchant_id = ? AND event_name = 'merchant_profile_viewed'
       AND COALESCE(source_section, '') <> 'provider_card'
       AND anonymous_user_id <> ?`,
    [businessId, exclude],
  );

  return { range, ...aggregateVisits(events, windows), lifetimeVisits: lifetime?.n ?? 0 };
}
