import { listBusinessReviews } from "../../services/reviews.js";

export default async function publicReviewRoutes(app) {
  // Published reviews for a business's public page, newest first, plus the
  // live average and count. No auth — anyone browsing can read reviews.
  app.get("/businesses/:businessId/reviews", async (request) => {
    return listBusinessReviews(request.params.businessId);
  });
}
