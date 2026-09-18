import { consumerAuth } from "../../middleware/consumer-auth.js";
import { badRequest } from "../../lib/http-errors.js";
import { saveUserPhotoUpload } from "../../services/consumer-media.js";
import { queryOne } from "../../db/connection.js";
import { serializeConsumer } from "../../services/consumer-auth.js";

export default async function consumerMediaRoutes(app) {
  app.addHook("preHandler", consumerAuth);

  // Accepts one multipart file field named "photo" and sets it directly as
  // the signed-in consumer's profile picture (see saveUserPhotoUpload).
  app.post("/photo", async (request) => {
    const file = await request.file();
    if (!file) throw badRequest("no_file", "No photo was uploaded.");

    await saveUserPhotoUpload({ userId: request.consumer.userId, file });

    const user = await queryOne("SELECT * FROM users WHERE id = ?", [request.consumer.userId]);
    return { ok: true, consumer: serializeConsumer(user) };
  });
}
