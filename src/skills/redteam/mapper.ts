import type {
  RedteamInput,
  RedteamOutput,
  OverallRiskLevel,
  Recommendation,
  ModeUsed,
  FailureMode,
  KeyAssumption,
  DecisionRecommendation,
  Commitment,
  Citation,
} from "./types.js";

// ── Enum maps ───────────────────────────────────────────────────────

const RISK_LEVEL_MAP: Record<string, OverallRiskLevel> = {
  low: "low", minor: "low",
  medium: "medium", moderate: "medium",
  high: "high", significant: "high",
  critical: "critical", severe: "critical", extreme: "critical",
};

const RECOMMENDATION_MAP: Record<string, Recommendation> = {
  proceed: "proceed", go: "proceed", green: "proceed",
  proceed_with_guards: "proceed_with_guards", proceed_with_conditions: "proceed_with_guards",
  pause: "pause", hold: "pause", wait: "pause",
  stop: "stop", no_go: "stop", abort: "stop",
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

function normalizeArray<T>(
  value: unknown,
  normalizer: (item: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map(normalizer);
}

// ── Token overlap for deduplication ─────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((t) => t.length > 0),
  );
}

function tokenOverlap(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let shared = 0;
  for (const tok of setA) {
    if (setB.has(tok)) shared++;
  }
  return shared / Math.max(setA.size, setB.size);
}

// ── Sub-normalizers ─────────────────────────────────────────────────

function normalizeFailureMode(raw: Record<string, unknown>): FailureMode {
  return {
    id: asString(raw.id, ""),
    title: asString(raw.title, "Untitled failure mode"),
    severity: clampInt(raw.severity, 1, 5),
    likelihood: clampInt(raw.likelihood, 1, 5),
    why_it_fails: asString(raw.why_it_fails, ""),
    leading_indicators: ensureStringArray(raw.leading_indicators),
    mitigation: asString(raw.mitigation, ""),
  };
}

function normalizeAssumption(raw: Record<string, unknown>): KeyAssumption {
  return {
    assumption: asString(raw.assumption, ""),
    confidence: clampFloat(raw.confidence, 0, 1),
    evidence_from_transcript: asString(raw.evidence_from_transcript, ""),
  };
}

function normalizeRecommendation(raw: unknown): DecisionRecommendation {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    recommendation: normalizeEnum(obj.recommendation, RECOMMENDATION_MAP, "proceed_with_guards"),
    rationale: asString(obj.rationale, ""),
    required_next_checks: ensureStringArray(obj.required_next_checks),
  };
}

function normalizeCommitment(raw: Record<string, unknown>): Commitment {
  return {
    owner: asString(raw.owner, "Unassigned"),
    due_date_or_window: asString(raw.due_date_or_window, ""),
    commitment: asString(raw.commitment, ""),
    proof_artifact: asString(raw.proof_artifact, ""),
  };
}

function normalizeCitation(raw: Record<string, unknown>): Citation {
  return {
    quote: asString(raw.quote, ""),
    speaker: asString(raw.speaker, "Unknown"),
    approximate_location: asString(raw.approximate_location, ""),
  };
}

// ── Deduplication ───────────────────────────────────────────────────

function deduplicateFailureModes(modes: FailureMode[]): FailureMode[] {
  const result: FailureMode[] = [];
  for (const candidate of modes) {
    const duplicate = result.find(
      (existing) => tokenOverlap(existing.title, candidate.title) > 0.8,
    );
    if (duplicate) {
      if (candidate.severity > duplicate.severity) {
        Object.assign(duplicate, candidate);
      }
    } else {
      result.push({ ...candidate });
    }
  }
  return result;
}

// ── Mode detection ──────────────────────────────────────────────────

function detectMode(input: RedteamInput): ModeUsed {
  if (
    input.focus_idea !== undefined ||
    (input.focus_questions !== undefined && input.focus_questions.length > 0)
  ) {
    return "transcript_plus_focus";
  }
  return "transcript_only";
}

// ── Main normalizer ─────────────────────────────────────────────────

export interface NormalizeResult {
  output: RedteamOutput;
  warnings: string[];
  inferred_fields: string[];
}

export function normalizeOutput(
  raw: unknown,
  input: RedteamInput,
): NormalizeResult {
  const warnings: string[] = [];
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  let failureModes = normalizeArray(obj.failure_modes, normalizeFailureMode);
  const beforeDedup = failureModes.length;
  failureModes = deduplicateFailureModes(failureModes);
  const deduped = beforeDedup - failureModes.length;
  if (deduped > 0) {
    warnings.push(`${deduped} failure mode(s) deduplicated`);
  }

  failureModes = failureModes.map((fm, i) => ({
    ...fm,
    id: `FM-${String(i + 1).padStart(3, "0")}`,
  }));

  const mode = detectMode(input);

  const inferred_fields: string[] = [];
  const lowConfidence = failureModes
    .filter((fm) => fm.severity <= 2 && fm.likelihood <= 2)
    .map((fm) => fm.id);

  const output: RedteamOutput = {
    summary: asString(obj.summary, ""),
    overall_risk_level: normalizeEnum(obj.overall_risk_level, RISK_LEVEL_MAP, "medium"),
    thesis_under_test: asString(obj.thesis_under_test, ""),
    key_assumptions: normalizeArray(obj.key_assumptions, normalizeAssumption),
    failure_modes: failureModes,
    adversarial_questions: ensureStringArray(obj.adversarial_questions),
    decision_recommendation: normalizeRecommendation(obj.decision_recommendation),
    commitments_extracted: normalizeArray(obj.commitments_extracted, normalizeCommitment),
    citations: normalizeArray(obj.citations, normalizeCitation),
    metadata: {
      mode_used: mode,
      generated_at: new Date().toISOString(),
    },
  };

  return { output, warnings, inferred_fields };
}
