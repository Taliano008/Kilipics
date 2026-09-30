import { consumerAuth } from "../../middleware/consumer-auth.js";
import { getOwnReview, upsertReview } from "../../services/reviews.js";

export default async function consumerReviewRoutes(app) {
  app.addHook("preHandler", consumerAuth);

  // The signed-in consumer's own review of a business (null if none yet) —
  // lets the review form open pre-filled for editing.
  app.get("/businesses/:businessId/review", async (request) => {
    const review = await getOwnReview(request.consumer.userId, request.params.businessId);
    return { review };
  });

  // Write or edit this consumer's review. One per business.
  app.put(
    "/businesses/:businessId/review",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request) => {
      const review = await upsertReview(
        request.consumer.userId,
        request.params.businessId,
        request.body || {},
      );
      return { ok: true, review };
    },
  );
}
