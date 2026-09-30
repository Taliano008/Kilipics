import { ulid } from "ulid";
import { execute } from "../../db/connection.js";
import { env } from "../../env.js";

// MySQL's INSERT IGNORE silently truncated over-long strings and coerced
// odd numbers; Postgres rejects them, which would fail the whole batch (and
// the client would retry it forever). Clip to the column sizes in
// 009_analytics_events.sql instead.
function clip(value, maxLength) {
  return value ? String(value).slice(0, maxLength) : null;
}

function screenDimension(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 && n <= 65535 ? n : null;
}

export default async function analyticsRoutes(app) {
  app.post("/events", async (request, reply) => {
    // Check app token
    const appToken = request.headers["x-app-token"];
    if (env.analyticsAppToken && appToken !== env.analyticsAppToken) {
      // Never log either token — the expected one is a secret, and the
      // supplied one may be a near-miss of it.
      request.log.warn({ tokenProvided: Boolean(appToken) }, "Unauthorized analytics ingest attempt");
      reply.code(401);
      return { error: "unauthorized", message: "Invalid app token" };
    }

    const { events } = request.body || {};
    if (!Array.isArray(events)) {
      reply.code(400);
      return { error: "invalid_payload", message: "Expected an events array" };
    }

    if (events.length === 0) {
      return { ok: true, inserted: 0 };
    }

    // Insert into analytics_events. Duplicates are dropped by ON CONFLICT DO NOTHING, so we can just map and insert.
    // For large payloads, batch insert would be better.
    let inserted = 0;
    
    // We map over the array. If the query gets too large we'd split it, but MAX_BUFFER in app is 500, which is safe.
    // We will build a single batch insert query.
    const values = [];
    const flatArgs = [];
    
    for (const evt of events) {
      // Basic validation
      if (!evt.eventId || !evt.anonymousUserId || !evt.sessionId || !evt.eventName || !evt.timestamp) {
        continue; // skip malformed events
      }
      
      const eventTimestamp = new Date(evt.timestamp);
      if (isNaN(eventTimestamp.valueOf())) continue;
      
      const dbId = ulid();
      
      values.push("(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      flatArgs.push(
        dbId,
        String(evt.eventId).slice(0, 100),
        String(evt.anonymousUserId).slice(0, 100),
        String(evt.sessionId).slice(0, 100),
        String(evt.eventName).slice(0, 100),
        eventTimestamp,
        clip(evt.pagePath, 500),
        clip(evt.pageTitle, 255),
        clip(evt.merchantId, 100),
        clip(evt.merchantName, 255),
        clip(evt.categoryId, 100),
        clip(evt.categoryName, 255),
        clip(evt.searchQuery, 500),
        clip(evt.sourceSurface, 100),
        clip(evt.sourceSection, 100),
        clip(evt.productVersion, 50),
        screenDimension(evt.screenWidth),
        screenDimension(evt.screenHeight),
        clip(evt.operatingSystem, 100),
        clip(evt.environment, 50),
        evt.metadata ? JSON.stringify(evt.metadata) : null
      );
    }
    
    if (values.length > 0) {
      const sql = `
        INSERT INTO analytics_events (
          id, event_id, anonymous_user_id, session_id, event_name, "timestamp",
          page_path, page_title, merchant_id, merchant_name, category_id,
          category_name, search_query, source_surface, source_section,
          product_version, screen_width, screen_height, operating_system,
          environment, metadata
        ) VALUES ${values.join(", ")}
        ON CONFLICT DO NOTHING
      `;
      try {
        const result = await execute(sql, flatArgs);
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
