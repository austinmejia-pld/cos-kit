// ── LLM client contract ────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>;
}

// ── Input types (mirrors schemas/execution-friction-xray.input.schema.json) ──

export interface ParticipantEntry {
  name: string;
  role: string;
  team: string;
}

export type UrgencyLevel = "low" | "medium" | "high" | "critical";
export type AnalysisDepth = "quick" | "standard" | "deep";

export interface ExecutionFrictionXrayInput {
  transcript: string;
  meeting_title?: string;
  meeting_datetime?: string;
  team_context?: string;
  focus_area?: string;
  urgency_level?: UrgencyLevel;
  analysis_depth?: AnalysisDepth;
  participant_directory?: ParticipantEntry[];
  key_questions?: string[];
}

// ── Output types (mirrors schemas/execution-friction-xray.output.schema.json) ──

export type FrictionCategory =
  | "ownership"
  | "dependency"
  | "timeline"
  | "scope"
  | "decision_latency"
  | "handoff"
  | "resourcing"
  | "signal_noise";

export type BlastRadius = "local" | "cross_team" | "org_wide";
export type ModeUsed = "transcript_only" | "transcript_plus_context";

export interface EvidenceEntry {
  speaker: string;
  quote: string;
  approximate_location: string;
}

export interface FrictionHotspot {
  id: string;
  category: FrictionCategory;
  title: string;
  why_it_creates_drag: string;
  severity: number;
  likelihood: number;
  blast_radius: BlastRadius;
  early_warning_signals: string[];
  evidence: EvidenceEntry[];
  recommended_fix: string;
  owner_recommendation: string;
  target_resolution_window: string;
}

export interface CriticalPathRisk {
  risk: string;
  blocking_dependency: string;
  owner: string;
  due_or_trigger: string;
  unblock_action: string;
}

export interface Ambiguity {
  ambiguity: string;
  why_it_matters: string;
  proposed_clarifying_question: string;
}

export interface KillPlanAction {
  action: string;
  owner: string;
  due: string;
  proof_artifact: string;
}

export interface HighestLeverageMove {
  move: string;
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

export interface ExecutionFrictionXrayOutput {
  executive_summary: string;
  friction_score: number;
  friction_hotspots: FrictionHotspot[];
  critical_path_risks: CriticalPathRisk[];
  ambiguities_to_resolve: Ambiguity[];
  next_7_day_friction_kill_plan: KillPlanAction[];
  single_highest_leverage_move: HighestLeverageMove;
  citations: Citation[];
  metadata: OutputMetadata;
}

// ── Run result ──────────────────────────────────────────────────────

export interface Diagnostics {
  warnings: string[];
  low_confidence_hotspots: string[];
  inferred_fields: string[];
}

export interface RunResultSuccess {
  ok: true;
  data: ExecutionFrictionXrayOutput;
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
