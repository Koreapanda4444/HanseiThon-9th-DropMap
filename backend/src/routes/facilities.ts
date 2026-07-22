import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { facilityCategoryIds } from "../domain.js";
import { AppError } from "../errors.js";
import { findFacilities, findFacilityById, findFacilityClusters, getFacilityStats } from "../repositories/facility-repository.js";

const optionalNumber = z.preprocess(
  (value) => value === "" || value === undefined ? undefined : value,
  z.coerce.number().finite().optional(),
);

const querySchema = z.object({
  categoryId: z.enum(facilityCategoryIds).optional(),
  query: z.string().trim().min(1).max(80).optional(),
  ids: z.string().trim().max(4000).regex(/^\d+(\s*,\s*\d+)*$/).refine((value) => {
    const ids = value.split(",").map((id) => Number(id.trim()));
    return ids.length <= 200 && ids.every((id) => Number.isSafeInteger(id) && id > 0);
  }).optional(),
  latitude: optionalNumber.pipe(z.number().min(-90).max(90).optional()),
  longitude: optionalNumber.pipe(z.number().min(-180).max(180).optional()),
  radiusM: optionalNumber.pipe(z.number().int().min(50).max(50000).optional()),
  west: optionalNumber.pipe(z.number().min(-180).max(180).optional()),
  south: optionalNumber.pipe(z.number().min(-90).max(90).optional()),
  east: optionalNumber.pipe(z.number().min(-180).max(180).optional()),
  north: optionalNumber.pipe(z.number().min(-90).max(90).optional()),
  limit: z.coerce.number().int().min(1).max(50_000).optional(),
}).strict().superRefine((value, context) => {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    context.addIssue({ code: "custom", message: "latitude와 longitude는 함께 입력해야 합니다." });
  }
  const bounds = [value.west, value.south, value.east, value.north];
  if (bounds.some((item) => item !== undefined) && bounds.some((item) => item === undefined)) {
    context.addIssue({ code: "custom", message: "west, south, east, north는 함께 입력해야 합니다." });
  }
  if (value.radiusM !== undefined && value.latitude === undefined) {
    context.addIssue({ code: "custom", path: ["radiusM"], message: "반경 검색에는 위치가 필요합니다." });
  }
  if (bounds.every((item) => item !== undefined) && (value.west! >= value.east! || value.south! >= value.north!)) {
    context.addIssue({ code: "custom", message: "지도 영역이 올바르지 않습니다." });
  }
});

const idSchema = z.coerce.number().int().positive().safe();

const clusterQuerySchema = z.object({
  categoryId: z.enum(facilityCategoryIds).optional(),
  west: z.coerce.number().min(-180).max(180),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  north: z.coerce.number().min(-90).max(90),
  columns: z.coerce.number().int().min(4).max(32),
  rows: z.coerce.number().int().min(4).max(24),
}).strict().refine((value) => value.west < value.east && value.south < value.north);

export async function facilityRoutes(app: FastifyInstance) {
  app.get("/api/facilities", async (request) => {
    const parsed = querySchema.parse(request.query);
    const { ids: idsParam, ...filters } = parsed;
    const ids = idsParam
      ? idsParam.split(",").map((id) => String(Number(id.trim())))
      : undefined;
    return {
      facilities: await findFacilities({
        ...filters,
        ...(ids?.length ? { ids } : {}),
      }),
    };
  });

  app.get("/api/facility-clusters", async (request) => {
    const parsed = clusterQuerySchema.parse(request.query);
    return { clusters: await findFacilityClusters(parsed) };
  });

  app.get("/api/facilities/:id", async (request) => {
    const { id } = z.object({ id: idSchema }).strict().parse(request.params);
    const facility = await findFacilityById(id);
    if (!facility) throw new AppError("시설을 찾을 수 없습니다.", 404, "FACILITY_NOT_FOUND");
    return { facility };
  });

  app.get("/api/stats", async () => getFacilityStats());
}
