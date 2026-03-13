import type {
  StakeholderAnalysisInput,
  StakeholderAnalysisOutput,
  Stakeholder,
  PowerInterestEntry,
  CoalitionDynamics,
  Risk,
  EngagementStep,
  ActionItem,
  Citation,
} from "./types.js";

// ---- Enum normalization maps ----

const STANCE_MAP: Record<string, Stakeholder["stance"]> = {
  supportive: "supportive",
  support: "supportive",
  supporting: "supportive",
  ally: "supportive",
  neutral: "neutral",
  skeptical: "skeptical",
  skeptic: "skeptical",
  opposed: "opposed",
  oppose: "opposed",
  blocker: "opposed",
  block: "opposed",
  blocking: "opposed",
  against: "opposed",
  unknown: "unknown",
};

const INFLUENCE_MAP: Record<string, Stakeholder["influence_level"]> = {
  low: "low",
  medium: "medium",
  med: "medium",
  moderate: "medium",
  high: "high",
  critical: "critical",
  veto: "critical",
};

const CHANGE_READINESS_MAP: Record<string, Stakeholder["change_readiness"]> = {
  low: "low",
  medium: "medium",
  med: "medium",
  moderate: "medium",
  high: "high",
};

const QUADRANT_MAP: Record<string, PowerInterestEntry["quadrant"]> = {
  manage_closely: "manage_closely",
  manageclosely: "manage_closely",
  keep_satisfied: "keep_satisfied",
  keepsatisfied: "keep_satisfied",
  keep_informed: "keep_informed",
  keepinformed: "keep_informed",
  monitor: "monitor",
};

const CHANNEL_MAP: Record<string, EngagementStep["channel"]> = {
  "1:1": "1:1",
  "one_on_one": "1:1",
  "1-1": "1:1",
  group: "group",
  email: "email",
  doc: "doc",
  document: "doc",
  async: "async",
  asynchronous: "async",
};

// ---- Helpers ----

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

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0
    ? value
    : fallback;
}

// ---- Normalization functions for each sub-object ----

function normalizeStakeholder(raw: Record<string, unknown>): Stakeholder {
  return {
    name: asString(raw.name, "Unknown"),
    role: asString(raw.role, "Unknown"),
    influence_level: normalizeEnum(raw.influence_level, INFLUENCE_MAP, "medium"),
    stance: normalizeEnum(raw.stance, STANCE_MAP, "unknown"),
    evidence: ensureStringArray(raw.evidence),
    goals: ensureStringArray(raw.goals),
    concerns: ensureStringArray(raw.concerns),
    hidden_incentives_or_constraints: ensureStringArray(raw.hidden_incentives_or_constraints),
    alignment_score: clampInt(raw.alignment_score, 0, 100),
    change_readiness: normalizeEnum(raw.change_readiness, CHANGE_READINESS_MAP, "medium"),
  };
}

function normalizePowerInterestEntry(raw: Record<string, unknown>): PowerInterestEntry {
  return {
    name: asString(raw.name, "Unknown"),
    power: clampInt(raw.power, 1, 5),
    interest: clampInt(raw.interest, 1, 5),
    quadrant: normalizeEnum(raw.quadrant, QUADRANT_MAP, "monitor"),
  };
}

function normalizeCoalitionDynamics(raw: unknown): CoalitionDynamics {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    likely_allies: ensureStringArray(obj.likely_allies),
    likely_blockers: ensureStringArray(obj.likely_blockers),
    swing_stakeholders: ensureStringArray(obj.swing_stakeholders),
    relationship_risks: ensureStringArray(obj.relationship_risks),
  };
}

function normalizeRisk(raw: Record<string, unknown>): Risk {
  return {
    id: asString(raw.id, "SR-000"),
    title: asString(raw.title, "Untitled risk"),
    severity: clampInt(raw.severity, 1, 5),
    likelihood: clampInt(raw.likelihood, 1, 5),
    owner_recommendation: asString(raw.owner_recommendation, "Unassigned"),
    early_signals: ensureStringArray(raw.early_signals),
    mitigation: asString(raw.mitigation, ""),
  };
}

function normalizeEngagementStep(raw: Record<string, unknown>): EngagementStep {
  return {
    stakeholder: asString(raw.stakeholder, "Unknown"),
    objective: asString(raw.objective, ""),
    message_frame: asString(raw.message_frame, ""),
    ask: asString(raw.ask, ""),
    channel: normalizeEnum(raw.channel, CHANNEL_MAP, "1:1"),
    timing: asString(raw.timing, ""),
    owner: asString(raw.owner, "Unassigned"),
    success_signal: asString(raw.success_signal, ""),
  };
}

function normalizeActionItem(raw: Record<string, unknown>): ActionItem {
  return {
    action: asString(raw.action, ""),
    owner: asString(raw.owner, "Unassigned"),
    due: asString(raw.due, ""),
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

function normalizeArray<T>(
  value: unknown,
  normalizer: (item: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map(normalizer);
}

// ---- Detect mode from input ----

function detectMode(
  input: StakeholderAnalysisInput,
): "transcript_only" | "transcript_plus_context" {
  const contextFields: (keyof StakeholderAnalysisInput)[] = [
    "focal_decision",
    "analysis_goal",
    "org_context",
    "stakeholder_directory",
    "key_questions",
    "time_horizon",
    "confidence_threshold",
  ];
  const hasContext = contextFields.some((f) => input[f] !== undefined);
  return hasContext ? "transcript_plus_context" : "transcript_only";
}

// ---- Main normalizer ----

export function normalizeOutput(
  raw: unknown,
  input: StakeholderAnalysisInput,
): StakeholderAnalysisOutput {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const output: StakeholderAnalysisOutput = {
    executive_summary: asString(obj.executive_summary, ""),
    decision_surface: asString(obj.decision_surface, ""),
    stakeholders: normalizeArray(obj.stakeholders, normalizeStakeholder),
    power_interest_map: normalizeArray(obj.power_interest_map, normalizePowerInterestEntry),
    coalition_dynamics: normalizeCoalitionDynamics(obj.coalition_dynamics),
    risks: normalizeArray(obj.risks, normalizeRisk),
    engagement_plan: normalizeArray(obj.engagement_plan, normalizeEngagementStep),
    next_7_day_actions: normalizeArray(obj.next_7_day_actions, normalizeActionItem),
    open_questions: ensureStringArray(obj.open_questions),
    citations: normalizeArray(obj.citations, normalizeCitation),
    metadata: {
      mode_used: detectMode(input),
      generated_at: new Date().toISOString(),
    },
  };

  if (obj.recommended_path && typeof obj.recommended_path === "object") {
    output.recommended_path = obj.recommended_path as StakeholderAnalysisOutput["recommended_path"];
  }

  return output;
}

// ---- Confidence heuristic ----

export interface ConfidenceAssessment {
  high: boolean;
  reasons: string[];
}

export function assessConfidence(
  output: StakeholderAnalysisOutput,
): ConfidenceAssessment {
  const reasons: string[] = [];

  const stakeholdersWithEvidence = output.stakeholders.filter(
    (s) => s.evidence.length > 0,
  ).length;
  if (stakeholdersWithEvidence >= 3) {
    reasons.push(
      `${stakeholdersWithEvidence} stakeholders have transcript evidence`,
    );
  } else {
    reasons.push(
      `Only ${stakeholdersWithEvidence} stakeholder(s) have transcript evidence (need >=3)`,
    );
  }

  const citationCount = output.citations.length;
  if (citationCount >= 2) {
    reasons.push(`${citationCount} citations provided`);
  } else {
    reasons.push(
      `Only ${citationCount} citation(s) (need >=2)`,
    );
  }

  const hasDecisionSurface = output.decision_surface.length > 0;
  if (hasDecisionSurface) {
    reasons.push("Decision surface identified");
  } else {
    reasons.push("No decision surface identified");
  }

  const high =
    stakeholdersWithEvidence >= 3 && citationCount >= 2 && hasDecisionSurface;

  return { high, reasons };
}
