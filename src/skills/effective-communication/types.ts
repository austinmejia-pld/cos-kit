// ── LLM client contract ────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>;
}

// ── Input types (mirrors schemas/effective-communication.input.schema.json) ──

export interface ParticipantEntry {
  name: string;
  role: string;
  team: string;
}

export type ToneTarget = "neutral" | "warm" | "assertive" | "executive";
export type AnalysisDepth = "quick" | "standard" | "deep";
export type FocusArea =
  | "clarity"
  | "brevity"
  | "executive_presence"
  | "structure"
  | "listening"
  | "ownership_language"
  | "handling_pushback"
  | "closing";

export interface EffectiveCommunicationInput {
  transcript: string;
  meeting_title?: string;
  meeting_datetime?: string;
  user_name?: string;
  communication_goal?: string;
  audience_context?: string;
  tone_target?: ToneTarget;
  analysis_depth?: AnalysisDepth;
  participant_directory?: ParticipantEntry[];
  focus_areas?: FocusArea[];
  key_questions?: string[];
}

// ── Output types (mirrors schemas/effective-communication.output.schema.json) ─

export type CommunicationStatus =
  | "excellent"
  | "strong_with_gaps"
  | "mixed"
  | "needs_improvement";

export type ImpactLevel = "low" | "medium" | "high" | "critical";
export type BalanceAssessment = "under_talking" | "balanced" | "over_talking" | "unknown";
export type ModeUsed = "transcript_only" | "transcript_plus_context";

export interface ScoreBreakdown {
  clarity: number;
  brevity: number;
  structure: number;
  audience_alignment: number;
  executive_presence: number;
  action_orientation: number;
  listening_and_responsiveness: number;
}

export interface EvidenceEntry {
  speaker: string;
  quote: string;
  approximate_location: string;
}

export interface Rewrite {
  before: string;
  after: string;
  why_better: string;
}

export interface PriorityImprovement {
  theme: string;
  diagnosis: string;
  why_it_costs_you: string;
  impact_level: ImpactLevel;
  evidence: EvidenceEntry[];
  rewrite: Rewrite;
  drill: string;
}

export interface MissedOpportunity {
  moment: string;
  what_happened: string;
  better_move: string;
  sample_line: string;
}

export interface FillerPattern {
  pattern: string;
  count_estimate: string;
  replacement_pattern: string;
}

export interface TalkTimeSignal {
  user_share_estimate: string;
  balance_assessment: BalanceAssessment;
  note: string;
}

export interface NextMeetingGameplan {
  opening_script: string;
  three_non_negotiables: [string, string, string];
  pushback_response_template: string;
  closing_script: string;
}

export interface OneThingToChange {
  change: string;
  why: string;
  success_signal: string;
}

export interface Citation {
  quote: string;
  speaker: string;
  approximate_location: string;
}

export interface OutputMetadata {
  mode_used: ModeUsed;
  analysis_depth_used: AnalysisDepth;
  generated_at: string;
}

export interface EffectiveCommunicationOutput {
  executive_summary: string;
  overall_effectiveness_score: number;
  communication_status: CommunicationStatus;
  coach_take: string;
  score_breakdown: ScoreBreakdown;
  what_worked: string[];
  priority_improvements: PriorityImprovement[];
  missed_opportunities: MissedOpportunity[];
  filler_or_hedging_patterns: FillerPattern[];
  talk_time_signal: TalkTimeSignal;
  next_meeting_gameplan: NextMeetingGameplan;
  one_thing_to_change_next_meeting: OneThingToChange;
  citations: Citation[];
  metadata: OutputMetadata;
}

// ── Run result ──────────────────────────────────────────────────────

export interface EffectiveCommunicationSuccess {
  ok: true;
  data: EffectiveCommunicationOutput;
  diagnostics: {
    warnings: string[];
    repair_attempted: boolean;
  };
}

export interface EffectiveCommunicationError {
  ok: false;
  error: string;
  validation_errors?: Array<{ path: string; message: string; keyword: string }>;
  raw_response?: string;
}

export type RunResult = EffectiveCommunicationSuccess | EffectiveCommunicationError;
