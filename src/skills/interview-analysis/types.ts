export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>;
}

// ── Input types ─────────────────────────────────────────────────────

export type Stage = "recruiter_screen" | "hiring_manager" | "onsite" | "panel" | "final";

export interface Anchor {
  score: number;
  definition: string;
}

export interface Dimension {
  name: string;
  description: string;
  scale_min: number;
  scale_max: number;
  must_have?: boolean;
  anchors?: Anchor[];
}

export interface Rubric {
  dimensions: Dimension[];
}

export interface InterviewAnalysisInput {
  candidate_name: string;
  role: string;
  stage: Stage;
  transcript: string;
  rubric: Rubric;
  interviewer?: string;
  must_have_requirements?: string[];
  interview_date?: string;
  interview_id?: string;
  rubric_version?: string;
}

// ── Output types ────────────────────────────────────────────────────

export type Recommendation = "strong_yes" | "yes" | "mixed" | "no" | "strong_no";

export interface DimensionScore {
  dimension: string;
  score: number;
  rationale: string;
  evidence_quotes: string[];
}

export interface InterviewAnalysisOutput {
  recommendation: Recommendation;
  confidence: number;
  decision_summary: string;
  dimension_scores: DimensionScore[];
  strengths: string[];
  concerns: string[];
  risk_flags: string[];
  interviewer_feedback: string[];
  follow_up_questions: string[];
}

// ── Run result ──────────────────────────────────────────────────────

export interface Diagnostics {
  warnings: string[];
}

export interface RunResultSuccess {
  ok: true;
  data: InterviewAnalysisOutput;
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
