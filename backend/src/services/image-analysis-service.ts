import { z } from "zod";
import { env } from "../config/env.js";
import { facilityCategoryIds } from "../domain.js";
import { AppError } from "../errors.js";
import { readLimitedResponseText } from "./http-response.js";

const boundingBoxSchema = z.object({
  x: z.number().finite().min(0).max(99),
  y: z.number().finite().min(0).max(99),
  width: z.number().finite().min(1).max(100),
  height: z.number().finite().min(1).max(100),
}).strict().transform((box) => ({
  ...box,
  width: Math.min(box.width, 100 - box.x),
  height: Math.min(box.height, 100 - box.y),
}));

const modelResultSchema = z.object({
  items: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    categoryId: z.enum(facilityCategoryIds),
    confidence: z.number().finite().min(0).max(1),
    boundingBox: boundingBoxSchema,
    disposalTip: z.string().trim().min(1).max(500),
  }).strict()).max(12),
}).strict();

const responsesApiResponseSchema = z.object({
  output_text: z.string().max(500_000).nullish(),
  output: z.array(z.object({
    content: z.array(z.object({
      type: z.string().max(100).optional(),
      text: z.string().max(500_000).optional(),
    })).max(100).optional(),
  })).max(100).optional(),
});

type ResponsesApiResponse = z.infer<typeof responsesApiResponseSchema>;

function outputText(response: ResponsesApiResponse) {
  if (response.output_text) return response.output_text;
  for (const output of response.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return null;
}

const resultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "categoryId", "confidence", "boundingBox", "disposalTip"],
        properties: {
          name: { type: "string" },
          categoryId: { type: "string", enum: facilityCategoryIds },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          boundingBox: {
            type: "object",
            additionalProperties: false,
            required: ["x", "y", "width", "height"],
            properties: {
              x: { type: "number", minimum: 0, maximum: 99 },
              y: { type: "number", minimum: 0, maximum: 99 },
              width: { type: "number", minimum: 1, maximum: 100 },
              height: { type: "number", minimum: 1, maximum: 100 },
            },
          },
          disposalTip: { type: "string" },
        },
      },
    },
  },
};

export async function analyzeWasteImage(imageDataUrl: string) {
  if (!env.NEKOS_API_KEY) {
    throw new AppError("현재 사진 분석을 이용할 수 없습니다.", 503, "IMAGE_ANALYSIS_NOT_CONFIGURED");
  }

  const endpoint = `${env.NEKOS_BASE_URL.replace(/\/$/, "")}/responses`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NEKOS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.NEKOS_VISION_MODEL,
        reasoning: { effort: "none" },
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "사진에서 버릴 수 있는 물품을 각각 찾아 한국어 이름, 분리배출 카테고리, 신뢰도, 사진 전체를 0부터 100으로 본 바운딩 박스, 실제 배출 방법을 반환하세요. 서로 겹친 물품도 구분하고 배경이나 가구는 제외하세요. 카테고리는 general, recycle, medicine, battery, clothes, cigarette 중 하나만 사용하세요.",
            },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        }],
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "waste_image_analysis",
            strict: true,
            schema: resultJsonSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
      redirect: "error",
    });
  } catch {
    throw new AppError("사진 분석 서버에 연결하지 못했습니다.", 502, "IMAGE_ANALYSIS_CONNECTION_FAILED");
  }

  if (!response.ok) {
    throw new AppError("사진을 분석하지 못했습니다.", 502, "IMAGE_ANALYSIS_FAILED");
  }

  let responseText: string;
  try {
    responseText = await readLimitedResponseText(response, 512 * 1024);
  } catch {
    throw new AppError("사진 분석 결과를 확인하지 못했습니다.", 502, "IMAGE_ANALYSIS_INVALID");
  }
  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(responseText);
  } catch {
    throw new AppError("사진 분석 결과를 확인하지 못했습니다.", 502, "IMAGE_ANALYSIS_INVALID");
  }
  const payloadResult = responsesApiResponseSchema.safeParse(rawPayload);
  if (!payloadResult.success) {
    throw new AppError("사진 분석 결과를 확인하지 못했습니다.", 502, "IMAGE_ANALYSIS_INVALID");
  }
  const payload = payloadResult.data;
  const text = outputText(payload);
  if (!text) throw new AppError("사진 분석 결과를 확인하지 못했습니다.", 502, "IMAGE_ANALYSIS_EMPTY");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AppError("사진 분석 결과를 확인하지 못했습니다.", 502, "IMAGE_ANALYSIS_INVALID");
  }
  const result = modelResultSchema.safeParse(parsed);
  if (!result.success) throw new AppError("사진 분석 결과를 확인하지 못했습니다.", 502, "IMAGE_ANALYSIS_INVALID");
  return result.data.items.map((item, index) => ({ ...item, id: `detected-${index + 1}` }));
}
