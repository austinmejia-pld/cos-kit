export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>;
}

// ── Input types ─────────────────────────────────────────────────────

export interface Context {
  prior_decisions?: string[];
  known_constraints?: string[];
  strategic_goals?: string[];
}

export interface MeetingRiskAnalysisInput {
  meeting_id: string;
  meeting_title: string;
  transcript: string;
  participants: string[];
  context: Context;
  meeting_date?: string;
  domain?: string;
  objectives?: string[];
}

// ── Output types ────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high";

export interface Risk {
  title: string;
  severity: RiskLevel;
  likelihood: RiskLevel;
  evidence_quotes: string[];
  impact: string;
  owner: string;
  mitigation: string;
}

export interface UnresolvedTension {
  tension: string;
  sides: string[];
  evidence_quotes: string[];
  why_it_matters: string;
}

export interface HiddenAssumption {
  assumption: string;
  risk_if_false: string;
  evidence_quotes: string[];
}

export interface DecisionGap {
  missing_decision: string;
  blocker: string;
  suggested_decision_owner: string;
}

export interface RecommendedAction {
  action: string;
  owner: string;
  due_date: string;
  success_artifact: string;
}

export interface MeetingRiskAnalysisOutput {
  executive_summary: string;
  overall_risk_level: RiskLevel;
  risks: Risk[];
  unresolved_tensions: UnresolvedTension[];
  hidden_assumptions: HiddenAssumption[];
  decision_gaps: DecisionGap[];
  recommended_actions: RecommendedAction[];
  confidence: number;
}

// ── Run result ──────────────────────────────────────────────────────

export interface Diagnostics {
  warnings: string[];
}

export interface RunResultSuccess {
  ok: true;
  data: MeetingRiskAnalysisOutput;
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
