
import "server-only";
import { GoogleGenAI } from "@google/genai";
import { ApiError } from "../server/http";

// Model utama
export const GEMINI_MODEL = "gemini-3.8-flash";

// Model cadangan, dicoba berurutan
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

export const GEMINI_TIMEOUT_MS = 30_000;

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new ApiError("Layanan AI belum dikonfigurasi.", 503);
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: GEMINI_TIMEOUT_MS,
    },
  });
}
