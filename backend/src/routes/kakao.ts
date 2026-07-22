import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { geocodeAddress } from "../services/kakao-service.js";

const schema = z.object({
  query: z.string().trim().min(2).max(120),
});

export async function kakaoRoutes(app: FastifyInstance) {
  app.get("/api/geocode", async (request) => {
    const { query } = schema.parse(request.query);
    return { results: await geocodeAddress(query) };
  });
}
