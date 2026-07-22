import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { geocodeAddress, searchPlaces } from "../services/kakao-service.js";

const schema = z.object({
  query: z.string().trim().min(2).max(120),
});

const optionalNumber = z.preprocess(
  (value) => value === "" || value === undefined ? undefined : value,
  z.coerce.number().finite().optional(),
);

const placeSchema = z.object({
  query: z.string().trim().min(2).max(120),
  latitude: optionalNumber.pipe(z.number().min(-90).max(90).optional()),
  longitude: optionalNumber.pipe(z.number().min(-180).max(180).optional()),
}).superRefine((value, context) => {
  if ((value.latitude === undefined) !== (value.longitude === undefined)) {
    context.addIssue({ code: "custom", message: "위치 정보가 올바르지 않습니다." });
  }
});

export async function kakaoRoutes(app: FastifyInstance) {
  app.get("/api/geocode", async (request) => {
    const { query } = schema.parse(request.query);
    return { results: await geocodeAddress(query) };
  });

  app.get("/api/places", async (request) => {
    const { query, latitude, longitude } = placeSchema.parse(request.query);
    return { results: await searchPlaces(query, latitude, longitude) };
  });
}
