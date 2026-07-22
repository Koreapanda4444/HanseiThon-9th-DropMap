import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { reportTypes } from "../domain.js";
import { AppError } from "../errors.js";
import { findFacilityById } from "../repositories/facility-repository.js";
import { createReport, listReports } from "../repositories/report-repository.js";
import { requireAccount } from "../services/auth-service.js";

const reportSchema = z.object({
  facilityId: z.coerce.number().int().positive(),
  reportType: z.enum(reportTypes),
  content: z.string().trim().min(5).max(1000),
});

async function withFacilityName(report: Awaited<ReturnType<typeof createReport>>) {
  const facility = await findFacilityById(Number(report.facilityId));
  return { ...report, facilityName: facility?.name ?? "등록 시설" };
}

export async function reportRoutes(app: FastifyInstance) {
  app.post("/api/reports", async (request, reply) => {
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

  app.get("/api/reports", async (request) => {
    const account = await requireAccount(request);
    const reports = await listReports(account.id);
    return { reports: await Promise.all(reports.map(withFacilityName)) };
  });
}
