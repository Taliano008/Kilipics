import Fastify from "fastify";
import AdminJSFastify from "@adminjs/fastify";
import { env, assertEnv } from "../env.js";
import { buildAdmin } from "./index.js";

assertEnv();

const app = Fastify({ logger: true });
const admin = await buildAdmin();

// No admin row in the database — credentials come from env only, per the
// spec. Same JWT_SECRET the main app uses for consumer/merchant tokens,
// reused here as the session cookie secret (it's already required to be
// >= 32 chars — see env.js's assertEnv).
await AdminJSFastify.buildAuthenticatedRouter(
  admin,
  {
    authenticate: async (email, password) => {
      if (email === env.adminEmail && password === env.adminPassword) {
        return { email };
      }
      return null;
    },
    cookieName: "kilipicks_admin",
    cookiePassword: env.jwtSecret,
  },
  app,
);

app.get("/", async (_request, reply) => {
  reply.redirect("/admin");
});

try {
  await app.listen({ port: env.adminPort, host: "127.0.0.1" });
  app.log.info(`AdminJS panel at http://localhost:${env.adminPort}/admin`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
