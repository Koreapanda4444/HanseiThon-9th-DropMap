import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createReport, findReportsByDevice } from "../repositories/report-repository.js";

const reportTypes = ["full", "missing", "broken", "location", "info"] as const;

const createSchema = z.object({
  facilityId: z.coerce.number().int().positive(),
  deviceId: z.string().uuid(),
  type: z.enum(reportTypes),
  content: z.string().trim().min(5).max(300),
});

const listSchema = z.object({
  deviceId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function reportRoutes(app: FastifyInstance) {
  app.post("/api/reports", async (request, reply) => {
    const input = createSchema.parse(request.body);
    const report = await createReport(input);
    return reply.status(201).send({ report });
  });

  app.get("/api/reports/:deviceId", async (request) => {
    const params = z.object({ deviceId: z.string().uuid() }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(request.query);
    const input = listSchema.parse({ ...params, ...query });
    return { reports: await findReportsByDevice(input.deviceId, input.limit) };
  });
}
