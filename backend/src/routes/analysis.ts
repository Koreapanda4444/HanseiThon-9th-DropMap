import { Buffer } from "node:buffer";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { analyzeWasteImage } from "../services/image-analysis-service.js";

const maximumImageBytes = 4 * 1024 * 1024;

function validImageData(value: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || !match[1] || !match[2] || match[2].length % 4 !== 0) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > maximumImageBytes || bytes.toString("base64") !== match[2]) return false;
  if (match[1] === "jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (match[1] === "png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

const imageSchema = z.object({
  image: z.string().max(5_600_000).refine(validImageData),
}).strict();

export async function analysisRoutes(app: FastifyInstance) {
  app.post("/api/analyze-image", {
    bodyLimit: 5_600_000 + 1024,
    config: { rateLimit: { max: 6, timeWindow: "10 minutes" } },
  }, async (request) => {
    const { image } = imageSchema.parse(request.body);
    return { items: await analyzeWasteImage(image) };
  });
}
