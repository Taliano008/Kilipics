import { getCatalogSnapshot } from "../../services/catalog.js";

export default async function publicCatalogRoutes(app) {
  app.get("/catalog", async (request, reply) => {
    const snapshot = await getCatalogSnapshot();
    reply.header("Cache-Control", "public, max-age=300");
    return snapshot;
  });
}
