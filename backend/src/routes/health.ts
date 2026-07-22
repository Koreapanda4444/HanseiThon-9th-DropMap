import type { FastifyInstance } from "fastify";
import { checkDatabase } from "../database/oracle.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    const database = await checkDatabase();
    return {
      status: database.connected ? "ok" : "degraded",
      service: "beoril-map-api",
      database,
      timestamp: new Date().toISOString(),
    };
  });
}
