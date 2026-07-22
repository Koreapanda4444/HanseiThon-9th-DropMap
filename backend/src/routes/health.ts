import type { FastifyInstance } from "fastify";
import { getDataSourceStatus } from "../services/data-source.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    const dataSource = await getDataSourceStatus();
    return {
      status: dataSource.available ? "ok" : "degraded",
      service: "beoril-map-api",
      dataSource: {
        mode: dataSource.mode,
        available: dataSource.available,
      },
      database: dataSource.database,
      timestamp: new Date().toISOString(),
    };
  });
}
