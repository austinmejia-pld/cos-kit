import type {
  InterviewAnalysisInput,
  InterviewAnalysisOutput,
  Recommendation,
  DimensionScore,
} from "./types.js";

// ── Enum maps ───────────────────────────────────────────────────────

const RECOMMENDATION_MAP: Record<string, Recommendation> = {
  strong_yes: "strong_yes", strongyes: "strong_yes", "strong yes": "strong_yes",
  yes: "yes", hire: "yes",
  mixed: "mixed", uncertain: "mixed", maybe: "mixed",
  no: "no", no_hire: "no",
  strong_no: "strong_no", strongno: "strong_no", "strong no": "strong_no",
};

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeEnum<T extends string>(
  value: unknown,
  map: Record<string, T>,
  fallback: T,
): T {
  if (typeof value !== "string") return fallback;
  const key = value.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return map[key] ?? fallback;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampFloat(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

// ── Sub-normalizers ─────────────────────────────────────────────────

function normalizeDimensionScore(raw: Record<string, unknown>): DimensionScore {
  const evidenceQuotes = ensureStringArray(raw.evidence_quotes);
  if (evidenceQuotes.length === 0) {
    evidenceQuotes.push("");
  }
  return {
    dimension: asString(raw.dimension, ""),
    score: clampInt(raw.score, 1, 4),
    rationale: asString(raw.rationale, ""),
    evidence_quotes: evidenceQuotes,
  };
}

// ── Main normalizer ─────────────────────────────────────────────────

export interface NormalizeResult {
  output: InterviewAnalysisOutput;
  warnings: string[];
}

export function normalizeOutput(
  raw: unknown,
  input: InterviewAnalysisInput,
): NormalizeResult {
  const warnings: string[] = [];
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  let dimensionScores: DimensionScore[] = [];
  if (Array.isArray(obj.dimension_scores)) {
    dimensionScores = obj.dimension_scores
      .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
      .map(normalizeDimensionScore);
  }

  const rubricDimNames = new Set(
    input.rubric.dimensions.map((d) => d.name.toLowerCase()),
  );
  const scoredDimNames = new Set(
    dimensionScores.map((d) => d.dimension.toLowerCase()),
  );

  for (const dimName of rubricDimNames) {
    if (!scoredDimNames.has(dimName)) {
      warnings.push(`Rubric dimension "${dimName}" missing from LLM output — adding placeholder`);
      dimensionScores.push({
        dimension: dimName,
        score: 1,
        rationale: "Insufficient evidence — dimension not scored by LLM",
        evidence_quotes: [""],
      });
    }
  }

  const output: InterviewAnalysisOutput = {
    recommendation: normalizeEnum(obj.recommendation, RECOMMENDATION_MAP, "mixed"),
    confidence: clampFloat(obj.confidence, 0, 1),
    decision_summary: asString(obj.decision_summary, "Insufficient data for summary."),
    dimension_scores: dimensionScores,
    strengths: ensureStringArray(obj.strengths),
    concerns: ensureStringArray(obj.concerns),
    risk_flags: ensureStringArray(obj.risk_flags),
    interviewer_feedback: ensureStringArray(obj.interviewer_feedback),
    follow_up_questions: ensureStringArray(obj.follow_up_questions),
  };

  return { output, warnings };
}
