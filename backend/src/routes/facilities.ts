import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { facilityCategoryIds } from "../domain.js";
import { AppError } from "../errors.js";
import { findFacilities, findFacilityById, getFacilityStats } from "../repositories/facility-repository.js";

const optionalNumber = z.preprocess(
  (value) => value === "" || value === undefined ? undefined : value,
  z.coerce.number().finite().optional(),
);

const querySchema = z.object({
  categoryId: z.enum(facilityCategoryIds).optional(),
  query: z.string().trim().min(1).max(80).optional(),
  ids: z.string().trim().regex(/^\d+(\s*,\s*\d+)*$/).optional(),
  latitude: optionalNumber.pipe(z.number().min(-90).max(90).optional()),
  longitude: optionalNumber.pipe(z.number().min(-180).max(180).optional()),
  radiusM: optionalNumber.pipe(z.number().int().min(50).max(50000).optional()),
  west: optionalNumber.pipe(z.number().min(-180).max(180).optional()),
  south: optionalNumber.pipe(z.number().min(-90).max(90).optional()),
  east: optionalNumber.pipe(z.number().min(-180).max(180).optional()),
  north: optionalNumber.pipe(z.number().min(-90).max(90).optional()),
  limit: z.coerce.number().int().min(1).optional(),
}).superRefine((value, context) => {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    context.addIssue({ code: "custom", message: "latitude와 longitude는 함께 입력해야 합니다." });
  }
  const bounds = [value.west, value.south, value.east, value.north];
  if (bounds.some((item) => item !== undefined) && bounds.some((item) => item === undefined)) {
    context.addIssue({ code: "custom", message: "west, south, east, north는 함께 입력해야 합니다." });
  }
});

const idSchema = z.coerce.number().int().positive();

export async function facilityRoutes(app: FastifyInstance) {
  app.get("/api/facilities", async (request) => {
    const parsed = querySchema.parse(request.query);
    const { ids: idsParam, ...filters } = parsed;
    const ids = idsParam
      ? idsParam.split(",").map((id) => id.trim())
      : undefined;
    return {
      facilities: await findFacilities({
        ...filters,
        ...(ids?.length ? { ids } : {}),
      }),
    };
  });

  app.get("/api/facilities/:id", async (request) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    const facility = await findFacilityById(id);
    if (!facility) throw new AppError("시설을 찾을 수 없습니다.", 404, "FACILITY_NOT_FOUND");
    return { facility };
  });

  app.get("/api/stats", async () => getFacilityStats());
}
