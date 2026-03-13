import type {
  MeetingRiskAnalysisInput,
  MeetingRiskAnalysisOutput,
  RiskLevel,
  Risk,
  UnresolvedTension,
  HiddenAssumption,
  DecisionGap,
  RecommendedAction,
} from "./types.js";

// ── Enum maps ───────────────────────────────────────────────────────

const RISK_LEVEL_MAP: Record<string, RiskLevel> = {
  low: "low", minor: "low",
  medium: "medium", moderate: "medium", med: "medium",
  high: "high", severe: "high", critical: "high",
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

function clampFloat(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function ensureStringArray(value: unknown, minItems = 0): string[] {
  if (!Array.isArray(value)) return [];
  const result = value.filter((v): v is string => typeof v === "string");
  if (result.length < minItems) {
    while (result.length < minItems) result.push("");
  }
  return result;
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

function normalizeRisk(raw: Record<string, unknown>): Risk {
  return {
    title: asString(raw.title, "Untitled risk"),
    severity: normalizeEnum(raw.severity, RISK_LEVEL_MAP, "medium"),
    likelihood: normalizeEnum(raw.likelihood, RISK_LEVEL_MAP, "medium"),
    evidence_quotes: ensureStringArray(raw.evidence_quotes, 1),
    impact: asString(raw.impact, ""),
    owner: asString(raw.owner, "Unassigned"),
    mitigation: asString(raw.mitigation, ""),
  };
}

function normalizeTension(raw: Record<string, unknown>): UnresolvedTension {
  const sides = ensureStringArray(raw.sides, 2);
  return {
    tension: asString(raw.tension, ""),
    sides,
    evidence_quotes: ensureStringArray(raw.evidence_quotes, 1),
    why_it_matters: asString(raw.why_it_matters, ""),
  };
}

function normalizeAssumption(raw: Record<string, unknown>): HiddenAssumption {
  return {
    assumption: asString(raw.assumption, ""),
    risk_if_false: asString(raw.risk_if_false, ""),
    evidence_quotes: ensureStringArray(raw.evidence_quotes, 1),
  };
}

function normalizeGap(raw: Record<string, unknown>): DecisionGap {
  return {
    missing_decision: asString(raw.missing_decision, ""),
    blocker: asString(raw.blocker, ""),
    suggested_decision_owner: asString(raw.suggested_decision_owner, "Unassigned"),
  };
}

function normalizeAction(raw: Record<string, unknown>): RecommendedAction {
  return {
    action: asString(raw.action, ""),
    owner: asString(raw.owner, "Unassigned"),
    due_date: asString(raw.due_date, ""),
    success_artifact: asString(raw.success_artifact, ""),
  };
}

// ── Deduplication ───────────────────────────────────────────────────

const SEVERITY_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

function deduplicateRisks(risks: Risk[]): Risk[] {
  const result: Risk[] = [];
  for (const candidate of risks) {
    const duplicate = result.find(
      (existing) => tokenOverlap(existing.title, candidate.title) > 0.8,
    );
    if (duplicate) {
      if (SEVERITY_RANK[candidate.severity] > SEVERITY_RANK[duplicate.severity]) {
        Object.assign(duplicate, candidate);
      }
    } else {
      result.push({ ...candidate });
    }
  }
  return result;
}

// ── Main normalizer ─────────────────────────────────────────────────

export interface NormalizeResult {
  output: MeetingRiskAnalysisOutput;
  warnings: string[];
}

export function normalizeOutput(
  raw: unknown,
  _input: MeetingRiskAnalysisInput,
): NormalizeResult {
  const warnings: string[] = [];
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  let risks = normalizeArray(obj.risks, normalizeRisk);
  const beforeDedup = risks.length;
  risks = deduplicateRisks(risks);
  const deduped = beforeDedup - risks.length;
  if (deduped > 0) {
    warnings.push(`${deduped} risk(s) deduplicated`);
  }

  const output: MeetingRiskAnalysisOutput = {
    executive_summary: asString(obj.executive_summary, ""),
    overall_risk_level: normalizeEnum(obj.overall_risk_level, RISK_LEVEL_MAP, "medium"),
    risks,
    unresolved_tensions: normalizeArray(obj.unresolved_tensions, normalizeTension),
    hidden_assumptions: normalizeArray(obj.hidden_assumptions, normalizeAssumption),
    decision_gaps: normalizeArray(obj.decision_gaps, normalizeGap),
    recommended_actions: normalizeArray(obj.recommended_actions, normalizeAction),
    confidence: clampFloat(obj.confidence, 0, 1),
  };

  return { output, warnings };
}
