// ── LLM client contract ────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>;
}

// ── Input types (mirrors schemas/commitment-extractor.input.schema.json) ───

export interface ParticipantEntry {
  name: string;
  role: string;
  team: string;
}

export type ExtractionMode = "strict" | "balanced" | "inclusive";

export interface CommitmentExtractorInput {
  transcript: string;
  meeting_title?: string;
  meeting_datetime?: string;
  default_timezone?: string;
  participant_directory?: ParticipantEntry[];
  focus_person?: string;
  extraction_mode?: ExtractionMode;
  include_non_actionable?: boolean;
}

// ── Output types (mirrors schemas/commitment-extractor.output.schema.json) ──

export type CommitmentType =
  | "deliverable"
  | "decision"
  | "follow_up"
  | "coordination"
  | "investigation";

export type OwnerConfidence = "low" | "medium" | "high";
export type CommitmentStatus = "new" | "carried" | "unclear";
export type Priority = "low" | "medium" | "high" | "critical";
export type ModeUsed = "transcript_only" | "transcript_plus_context";
export type MissingFieldKind = "owner" | "due_date" | "artifact" | "scope_clarity";

export interface SourceEvidenceEntry {
  speaker: string;
  quote: string;
  approximate_location: string;
}

export interface Commitment {
  id: string;
  commitment_text: string;
  commitment_type: CommitmentType;
  owner: string;
  owner_confidence: OwnerConfidence;
  due_date_raw: string;
  due_date_normalized: string;
  status: CommitmentStatus;
  priority: Priority;
  proof_artifact_expected: string;
  dependencies: string[];
  blockers: string[];
  source_evidence: SourceEvidenceEntry[];
  confidence_score: number;
}

export interface MissingFieldEntry {
  commitment_id: string;
  missing: MissingFieldKind[];
  suggested_followup_question: string;
}

export interface OwnerRollupEntry {
  owner: string;
  count: number;
  critical_count: number;
}

export interface OutputMetadata {
  mode_used: ModeUsed;
  generated_at: string;
}

export interface CommitmentExtractorOutput {
  summary: string;
  commitments: Commitment[];
  unassigned_actions: string[];
  missing_fields: MissingFieldEntry[];
  owner_rollup: OwnerRollupEntry[];
  metadata: OutputMetadata;
}

// ── Run result ──────────────────────────────────────────────────────

export interface CommitmentExtractorSuccess {
  ok: true;
  data: CommitmentExtractorOutput;
  diagnostics: {
    warnings: string[];
    low_confidence_commitments: string[];
  };
}

export interface CommitmentExtractorError {
  ok: false;
  error: string;
  validation_errors?: Array<{ path: string; message: string; keyword: string }>;
}

export type RunResult = CommitmentExtractorSuccess | CommitmentExtractorError;
