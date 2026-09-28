import { ulid } from "ulid";
import { query } from "../../db/connection.js";
import { env } from "../../env.js";

const MAX_EVENTS_PER_REQUEST = 1000;

export default async function analyticsRoutes(app) {
  app.post("/events", async (request, reply) => {
    // Check app token
    const appToken = request.headers["x-app-token"];
    if (env.analyticsAppToken && appToken !== env.analyticsAppToken) {
      // Never log the token values themselves — the expected one is a
      // server secret, and a wrong one is attacker-controlled noise.
      request.log.warn({ hasToken: Boolean(appToken) }, "Unauthorized analytics ingest attempt");
      reply.code(401);
      return { error: "unauthorized", message: "Invalid app token" };
    }

    const { events } = request.body || {};
    if (!Array.isArray(events)) {
      reply.code(400);
      return { error: "invalid_payload", message: "Expected an events array" };
    }

    // The client flushes at most MAX_BUFFER (500) events at once; anything
    // larger would also blow past MySQL's 65,535-placeholder limit (21 per
    // row) and fail the whole insert with a 500.
    if (events.length > MAX_EVENTS_PER_REQUEST) {
      reply.code(413);
      return { error: "too_many_events", message: `At most ${MAX_EVENTS_PER_REQUEST} events per request` };
    }

    if (events.length === 0) {
      return { ok: true, inserted: 0 };
    }

    // Insert into analytics_events. Since this is an insert ignore loop, we can just map and insert.
    // For large payloads, batch insert would be better.
    let inserted = 0;
    
    // We map over the array. If the query gets too large we'd split it, but MAX_BUFFER in app is 500, which is safe.
    // We will build a single batch insert query.
    const values = [];
    const flatArgs = [];
    
    for (const evt of events) {
      // Basic validation
      if (!evt || typeof evt !== "object" || !evt.eventId || !evt.anonymousUserId || !evt.sessionId || !evt.eventName || !evt.timestamp) {
        continue; // skip malformed events
      }
      
      const eventTimestamp = new Date(evt.timestamp);
      if (isNaN(eventTimestamp.valueOf())) continue;
      
      const dbId = ulid();
      
      values.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      flatArgs.push(
        dbId,
        String(evt.eventId),
        String(evt.anonymousUserId),
        String(evt.sessionId),
        String(evt.eventName),
        eventTimestamp,
        evt.pagePath ? String(evt.pagePath) : null,
        evt.pageTitle ? String(evt.pageTitle) : null,
        evt.merchantId ? String(evt.merchantId) : null,
        evt.merchantName ? String(evt.merchantName) : null,
        evt.categoryId ? String(evt.categoryId) : null,
        evt.categoryName ? String(evt.categoryName) : null,
        evt.searchQuery ? String(evt.searchQuery) : null,
        evt.sourceSurface ? String(evt.sourceSurface) : null,
        evt.sourceSection ? String(evt.sourceSection) : null,
        evt.productVersion ? String(evt.productVersion) : null,
        evt.screenWidth ? Number(evt.screenWidth) : null,
        evt.screenHeight ? Number(evt.screenHeight) : null,
        evt.operatingSystem ? String(evt.operatingSystem) : null,
        evt.environment ? String(evt.environment) : null,
        evt.metadata ? JSON.stringify(evt.metadata) : null
      );
    }
    
    if (values.length > 0) {
      const sql = `
        INSERT IGNORE INTO analytics_events (
          id, event_id, anonymous_user_id, session_id, event_name, timestamp,
          page_path, page_title, merchant_id, merchant_name, category_id,
          category_name, search_query, source_surface, source_section,
          product_version, screen_width, screen_height, operating_system,
          environment, metadata
        ) VALUES ${values.join(", ")}
      `;
      try {
        const result = await query(sql, flatArgs);
        inserted = result.affectedRows;
      } catch (err) {
        request.log.error({ err }, "Failed to insert analytics events batch");
        reply.code(500);
        return { error: "internal_error", message: "Failed to persist events" };
      }
    }

    return { ok: true, inserted };
  });
}
