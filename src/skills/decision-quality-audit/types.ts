// ── LLM client contract ────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>;
}

// ── Input types (mirrors schemas/decision-quality-audit.input.schema.json) ──

export interface ParticipantEntry {
  name: string;
  role: string;
  team: string;
}

export type RiskTolerance = "low" | "medium" | "high";
export type AnalysisDepth = "quick" | "standard" | "deep";

export interface DecisionQualityAuditInput {
  transcript: string;
  meeting_title?: string;
  meeting_datetime?: string;
  decision_focus?: string;
  strategic_context?: string;
  risk_tolerance?: RiskTolerance;
  analysis_depth?: AnalysisDepth;
  participant_directory?: ParticipantEntry[];
  key_questions?: string[];
}

// ── Output types (mirrors schemas/decision-quality-audit.output.schema.json) ──

export type DecisionStatus =
  | "clear_decision"
  | "tentative_decision"
  | "no_decision";

export type ImpactLevel = "low" | "medium" | "high" | "critical";
export type ExplicitOrImplicit = "explicit" | "implicit";
export type Validated = "yes" | "partial" | "no" | "unknown";
export type Confidence = "low" | "medium" | "high";
export type ModeUsed = "transcript_only" | "transcript_plus_context";

export interface ScoreBreakdown {
  clarity_of_decision: number;
  evidence_quality: number;
  alternatives_considered: number;
  risk_assessment_quality: number;
  ownership_and_accountability: number;
  reversibility_and_checkpoints: number;
}

export interface EvidenceEntry {
  speaker: string;
  quote: string;
  approximate_location: string;
}

export interface Gap {
  gap: string;
  why_it_matters: string;
  impact_level: ImpactLevel;
  evidence: EvidenceEntry[];
  fix: string;
}

export interface Assumption {
  assumption: string;
  explicit_or_implicit: ExplicitOrImplicit;
  validated: Validated;
  how_to_test_fast: string;
}

export interface AccountabilityEntry {
  owner: string;
  commitment: string;
  due_or_window: string;
  proof_artifact: string;
  confidence: Confidence;
}

export interface SingleUpgrade {
  upgrade: string;
  why: string;
  owner: string;
  deadline: string;
  success_signal: string;
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

export interface DecisionQualityAuditOutput {
  executive_summary: string;
  decision_surface: string;
  decision_status: DecisionStatus;
  decision_quality_score: number;
  score_breakdown: ScoreBreakdown;
  strengths: string[];
  gaps: Gap[];
  assumptions: Assumption[];
  alternatives_missing: string[];
  risks_underweighted: string[];
  accountability_snapshot: AccountabilityEntry[];
  decision_hygiene_upgrades_next_meeting: string[];
  single_most_important_upgrade: SingleUpgrade;
  citations: Citation[];
  metadata: OutputMetadata;
}

// ── Run result ──────────────────────────────────────────────────────

export interface Diagnostics {
  warnings: string[];
  low_confidence_sections: string[];
  inferred_fields: string[];
}

export interface RunResultSuccess {
  ok: true;
  data: DecisionQualityAuditOutput;
  diagnostics: Diagnostics;
}

export interface RunResultError {
  ok: false;
  error: {
    stage:
      | "input_validation"
      | "llm_call"
      | "json_parse"
      | "normalization"
      | "output_validation";
    message: string;
    details?: unknown;
  };
}

export type RunResult = RunResultSuccess | RunResultError;
