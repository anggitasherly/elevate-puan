
import { z } from "zod";

export const PRIMARY_PROBLEM_TYPES = [
  "low_awareness",
  "low_conversion",
  "weak_retention",
  "capacity_limit",
  "narrow_market",
  "inconsistent_promo",
  "product_stagnation",
  "weak_finance_habits",
];

const geminiInsight = {
  type: "object",
  properties: {
    insight: { type: "string" },
    experimentRefs: { type: "array", items: { type: "string" } },
    evidence: { type: "array", items: { type: "string" } },
    limitation: { type: "string" },
  },
  required: ["insight", "experimentRefs", "evidence", "limitation"],
};

export const geminiResponseSchema = {
  type: "object",
  properties: {
    businessAnalysis: {
      type: "object",
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        highlights: { type: "array", items: { type: "string" } },
        deepAnalysis: {
          type: "object",
          properties: {
            primaryProblemType: {
              type: "string",
              enum: [...PRIMARY_PROBLEM_TYPES, "unknown"],
            },
            overallBusinessAnalysis: geminiInsight,
            whatWorked: { type: "array", items: geminiInsight },
            whatDidNotWork: { type: "array", items: geminiInsight },
            whyItMightHaveHappened: { type: "array", items: geminiInsight },
            unresolvedProblemSignals: { type: "array", items: geminiInsight },
            emergingOpportunitySignals: { type: "array", items: geminiInsight },
          },
          required: [
            "primaryProblemType",
            "overallBusinessAnalysis",
            "whatWorked",
            "whatDidNotWork",
            "whyItMightHaveHappened",
            "unresolvedProblemSignals",
            "emergingOpportunitySignals",
          ],
        },
      },
      required: ["headline", "summary", "highlights", "deepAnalysis"],
    },
    diagnosis: {
      type: "object",
      properties: {
        worked: { type: "array", items: { type: "string" } },
        didNotWork: { type: "array", items: { type: "string" } },
        possibleCauses: { type: "array", items: { type: "string" } },
      },
      required: ["worked", "didNotWork", "possibleCauses"],
    },
    evidenceExplanation: { type: "string" },
    learnings: { type: "array", items: { type: "string" } },
  },
  required: ["businessAnalysis", "diagnosis", "evidenceExplanation", "learnings"],
};

const text = (max) => z.string().trim().min(1).max(max);
const list = (maxItems, maxChars) => z.array(text(maxChars)).max(maxItems);

const insightSchema = z.object({
  insight: text(600),
  experimentRefs: z.array(text(12)).max(10),
  evidence: list(5, 300),
  limitation: text(400),
});

export const aiOutputSchema = z.object({
  businessAnalysis: z.object({
    headline: text(200),
    summary: text(1200),
    highlights: list(5, 300),
    deepAnalysis: z.object({
      primaryProblemType: z
        .enum([...PRIMARY_PROBLEM_TYPES, "unknown"])
        .nullable(),
      overallBusinessAnalysis: insightSchema,
      whatWorked: z.array(insightSchema).max(5),
      whatDidNotWork: z.array(insightSchema).max(5),
      whyItMightHaveHappened: z.array(insightSchema).max(5),
      unresolvedProblemSignals: z.array(insightSchema).max(5),
      emergingOpportunitySignals: z.array(insightSchema).max(5),
    }),
  }),
  diagnosis: z.object({
    worked: list(5, 400),
    didNotWork: list(5, 400),
    possibleCauses: list(5, 400),
  }),
  evidenceExplanation: text(600),
  learnings: list(6, 400),
});

const FORBIDDEN_PATTERNS = [
  /\bsebaiknya\b/i,
  /\bdisarankan\b/i,
  /\bsaya\s+sarankan\b/i,
  /\brekomendasi\b/i,
  /\bperlu\s+(mencoba|melakukan|menjalankan|membuat)\b/i,
  /\b(coba|silakan)\s+(lakukan|jalankan|buat|gunakan|tingkatkan|perbaiki)\b/i,
  /\b(langkah|strategi|aksi)\s+berikutnya\b/i,
  /\beksperimen\s+(berikutnya|selanjutnya|baru)\b/i,
  /\bmulai\s+(dengan|melakukan|menjalankan)\b/i,
];

const isForbidden = (value) =>
  FORBIDDEN_PATTERNS.some((pattern) => pattern.test(value));

export function applyBusinessRules(output) {
  const { businessAnalysis, diagnosis, evidenceExplanation } = output;
  const deep = businessAnalysis.deepAnalysis;

  const allPrimaryText = [
    businessAnalysis.headline,
    businessAnalysis.summary,
    evidenceExplanation,
    deep.overallBusinessAnalysis.insight,
    ...Object.values(deep).flatMap((value) =>
      Array.isArray(value) ? value.map((item) => item.insight) : []
    ),
  ];

  if (allPrimaryText.some(isForbidden)) return { ok: false };

  let dropped = 0;

  const cleanStrings = (items) => items.filter((item) => {
    if (isForbidden(item)) {
      dropped += 1;
      return false;
    }
    return true;
  });

  const cleanInsights = (items) => items.filter((item) => {
    if (isForbidden(item.insight)) {
      dropped += 1;
      return false;
    }
    return true;
  });

  const cleanedDeep = {
    primaryProblemType:
      deep.primaryProblemType === "unknown"
        ? null
        : deep.primaryProblemType,
    overallBusinessAnalysis: deep.overallBusinessAnalysis,
    whatWorked: cleanInsights(deep.whatWorked),
    whatDidNotWork: cleanInsights(deep.whatDidNotWork),
    whyItMightHaveHappened: cleanInsights(deep.whyItMightHaveHappened),
    unresolvedProblemSignals: cleanInsights(deep.unresolvedProblemSignals),
    emergingOpportunitySignals: cleanInsights(deep.emergingOpportunitySignals),
  };

  return {
    ok: true,
    dropped,
    output: {
      businessAnalysis: {
        ...businessAnalysis,
        highlights: cleanStrings(businessAnalysis.highlights),
        deepAnalysis: cleanedDeep,
      },
      diagnosis: {
        worked: cleanStrings(diagnosis.worked),
        didNotWork: cleanStrings(diagnosis.didNotWork),
        possibleCauses: cleanStrings(diagnosis.possibleCauses),
      },
      evidenceExplanation,
      learnings: cleanStrings(output.learnings),
    },
  };
}
