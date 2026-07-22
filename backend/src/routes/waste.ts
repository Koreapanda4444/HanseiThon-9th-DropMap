import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { classifyWaste, findWasteItems } from "../repositories/waste-repository.js";

const listSchema = z.object({
  query: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const classifySchema = z.object({
  query: z.string().trim().min(1).max(200),
});

export async function wasteRoutes(app: FastifyInstance) {
  app.get("/api/waste-items", async (request) => {
    const query = listSchema.parse(request.query);
    return { items: await findWasteItems(query.query, query.limit) };
  });

  app.post("/api/classify", async (request) => {
    const { query } = classifySchema.parse(request.body);
    return { results: await classifyWaste(query) };
  });
}
