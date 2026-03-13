export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>;
}

// ── Input types ─────────────────────────────────────────────────────

export type RiskTolerance = "low" | "medium" | "high";

export interface RedteamInput {
  transcript: string;
  context?: string;
  audience?: string;
  risk_tolerance?: RiskTolerance;
  focus_idea?: string;
  focus_questions?: string[];
  constraints?: string[];
}

// ── Output types ────────────────────────────────────────────────────

export type OverallRiskLevel = "low" | "medium" | "high" | "critical";
export type Recommendation = "proceed" | "proceed_with_guards" | "pause" | "stop";
export type ModeUsed = "transcript_only" | "transcript_plus_focus";

export interface KeyAssumption {
  assumption: string;
  confidence: number;
  evidence_from_transcript: string;
}

export interface FailureMode {
  id: string;
  title: string;
  severity: number;
  likelihood: number;
  why_it_fails: string;
  leading_indicators: string[];
  mitigation: string;
}

export interface DecisionRecommendation {
  recommendation: Recommendation;
  rationale: string;
  required_next_checks: string[];
}

export interface Commitment {
  owner: string;
  due_date_or_window: string;
  commitment: string;
  proof_artifact: string;
}

export interface Citation {
  quote: string;
  speaker: string;
  approximate_location: string;
}

export interface OutputMetadata {
  mode_used: ModeUsed;
  generated_at: string;
}

export interface RedteamOutput {
  summary: string;
  overall_risk_level: OverallRiskLevel;
  thesis_under_test: string;
  key_assumptions: KeyAssumption[];
  failure_modes: FailureMode[];
  adversarial_questions: string[];
  decision_recommendation: DecisionRecommendation;
  commitments_extracted: Commitment[];
  citations: Citation[];
  metadata: OutputMetadata;
}

// ── Run result ──────────────────────────────────────────────────────

export interface Diagnostics {
  warnings: string[];
  low_confidence_failure_modes: string[];
  inferred_fields: string[];
}

export interface RunResultSuccess {
  ok: true;
  data: RedteamOutput;
  diagnostics: Diagnostics;
}

export interface RunResultError {
  ok: false;
  error: {
    stage: "input_validation" | "llm_call" | "json_parse" | "normalization" | "output_validation";
    message: string;
    details?: unknown;
  };
}

export type RunResult = RunResultSuccess | RunResultError;
