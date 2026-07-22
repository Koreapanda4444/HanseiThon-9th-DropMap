import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { reportTypes } from "../domain.js";
import { AppError } from "../errors.js";
import { findFacilities, findFacilityById } from "../repositories/facility-repository.js";
import { createReport, listReports } from "../repositories/report-repository.js";
import { requireAccount } from "../services/auth-service.js";

const reportSchema = z.object({
  facilityId: z.preprocess(
    (value) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
    z.number().int().positive().safe(),
  ),
  reportType: z.enum(reportTypes),
  content: z.string().trim().min(5).max(1000),
}).strict();

export async function reportRoutes(app: FastifyInstance) {
  app.post("/api/reports", { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } }, async (request, reply) => {
    const account = await requireAccount(request);
    const input = reportSchema.parse(request.body);
    const facility = await findFacilityById(input.facilityId);
    if (!facility) throw new AppError("시설을 찾을 수 없습니다.", 404, "FACILITY_NOT_FOUND");
    const now = new Date().toISOString();
    const report = await createReport({
      id: randomUUID(),
      userId: account.id,
      facilityId: String(input.facilityId),
      reportType: input.reportType,
      content: input.content,
      status: "received",
      createdAt: now,
      updatedAt: now,
    });
    return reply.status(201).send({ report: { ...report, facilityName: facility.name } });
  });

  app.get("/api/reports", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const account = await requireAccount(request);
    const reports = await listReports(account.id);
    const facilityIds = [...new Set(reports.map((report) => report.facilityId))];
    const facilities = facilityIds.length ? await findFacilities({ ids: facilityIds }) : [];
    const facilityNames = new Map(facilities.map((facility) => [facility.id, facility.name]));
    return {
      reports: reports.map((report) => ({
        ...report,
        facilityName: facilityNames.get(report.facilityId) ?? "등록 시설",
      })),
    };
  });
}
