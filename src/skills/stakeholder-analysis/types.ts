// ---- Input types ----

export interface StakeholderDirectoryEntry {
  name: string;
  role: string;
  team: string;
  power_hint?: "low" | "medium" | "high" | "critical";
}

export interface StakeholderAnalysisInput {
  transcript: string;
  analysis_goal?: string;
  focal_decision?: string;
  org_context?: string;
  stakeholder_directory?: StakeholderDirectoryEntry[];
  key_questions?: string[];
  time_horizon?: "immediate" | "30d" | "quarter" | "6-12m";
  confidence_threshold?: number;
}

// ---- Output types ----

export interface Stakeholder {
  name: string;
  role: string;
  influence_level: "low" | "medium" | "high" | "critical";
  stance: "supportive" | "neutral" | "skeptical" | "opposed" | "unknown";
  evidence: string[];
  goals: string[];
  concerns: string[];
  hidden_incentives_or_constraints: string[];
  alignment_score: number;
  change_readiness: "low" | "medium" | "high";
}

export interface PowerInterestEntry {
  name: string;
  power: number;
  interest: number;
  quadrant:
    | "manage_closely"
    | "keep_satisfied"
    | "keep_informed"
    | "monitor";
}

export interface CoalitionDynamics {
  likely_allies: string[];
  likely_blockers: string[];
  swing_stakeholders: string[];
  relationship_risks: string[];
}

export interface Risk {
  id: string;
  title: string;
  severity: number;
  likelihood: number;
  owner_recommendation: string;
  early_signals: string[];
  mitigation: string;
}

export interface EngagementStep {
  stakeholder: string;
  objective: string;
  message_frame: string;
  ask: string;
  channel: "1:1" | "group" | "email" | "doc" | "async";
  timing: string;
  owner: string;
  success_signal: string;
}

export interface ActionItem {
  action: string;
  owner: string;
  due: string;
  proof_artifact: string;
}

export interface Citation {
  quote: string;
  speaker: string;
  approximate_location: string;
}

export interface Metadata {
  mode_used: "transcript_only" | "transcript_plus_context";
  generated_at: string;
}

export interface LeverageEntry {
  stakeholder: string;
  why: string;
  how: string;
}

export interface ImproveRelationsEntry {
  stakeholder: string;
  why: string;
  how: string;
}

export interface WatchListEntry {
  stakeholder: string;
  signal: string;
  contingency: string;
}

export interface RecommendedPathActionable {
  status: "actionable";
  overall_recommendation: string;
  leverage: LeverageEntry[];
  improve_relations: ImproveRelationsEntry[];
  watch_list: WatchListEntry[];
}

export interface RecommendedPathInsufficientInfo {
  status: "insufficient_information";
  overall_recommendation: string;
  information_gaps: string[];
  suggested_next_steps: string[];
}

export type RecommendedPath =
  | RecommendedPathActionable
  | RecommendedPathInsufficientInfo;

export interface StakeholderAnalysisOutput {
  executive_summary: string;
  decision_surface: string;
  stakeholders: Stakeholder[];
  power_interest_map: PowerInterestEntry[];
  coalition_dynamics: CoalitionDynamics;
  risks: Risk[];
  engagement_plan: EngagementStep[];
  next_7_day_actions: ActionItem[];
  open_questions: string[];
  citations: Citation[];
  metadata: Metadata;
  recommended_path?: RecommendedPath;
}

// ---- Runtime result types ----

export interface Diagnostics {
  mode_used: "transcript_only" | "transcript_plus_context";
  warnings: string[];
  dropped_fields?: string[];
}

export interface RunResultSuccess {
  ok: true;
  data: StakeholderAnalysisOutput;
  diagnostics: Diagnostics;
}

export interface RunResultError {
  ok: false;
  error: {
    stage: "input_validation" | "json_parse" | "normalization" | "output_validation";
    message: string;
    details?: unknown;
  };
  diagnostics?: Diagnostics;
}

export type RunResult = RunResultSuccess | RunResultError;
