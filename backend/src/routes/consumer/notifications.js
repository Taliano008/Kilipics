import { consumerAuth } from "../../middleware/consumer-auth.js";
import { listNotifications, markAllNotificationsRead } from "../../services/notifications.js";

export default async function consumerNotificationRoutes(app) {
  app.addHook("preHandler", consumerAuth);

  // Newest first, with the unread count for the bell badge.
  app.get("/", async (request) => listNotifications(request.consumer.userId));

  // Opening the Notifications screen marks everything as read.
  app.post("/read", async (request) => {
    await markAllNotificationsRead(request.consumer.userId);
    return { ok: true };
  });
}
