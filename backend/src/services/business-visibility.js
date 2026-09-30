import { queryOne } from "../db/connection.js";

// The one definition of a business being "live" to consumers: an admin has
// published it AND its owning merchant isn't suspended. Search, booking and
// reviews all go through this, so the admin panel's Unpublish and Suspend
// actions each take a business fully offline on their own — neither relies
// on the admin remembering to also do the other, or to flip a second flag.
//
// LIVE_BUSINESSES_FROM is the FROM/WHERE for queries that list businesses
// (alias `b`); findLiveBusiness() is the single-row lookup.
export const LIVE_BUSINESSES_FROM = `
  FROM businesses b
  JOIN merchants m ON m.id = b.merchant_id
  WHERE b.publication_status = 'published' AND m.status <> 'suspended'`;

export async function findLiveBusiness(businessId) {
  return queryOne(`SELECT b.* ${LIVE_BUSINESSES_FROM} AND b.id = ?`, [businessId]);
}
