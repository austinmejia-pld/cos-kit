/**
 * Type definitions for the skill routing engine.
 *
 * The router suggests skills conversationally — it never auto-executes.
 * Skills enforce their own schemas; the router's job is matching
 * user intent to the right skill and presenting the suggestion.
 */

import type { LLMClient } from "./types.js";

// ── Skill metadata (merged from skill-registry + routes) ────────────

export interface SkillMeta {
  /** Canonical skill identifier, e.g. "commitment-extractor" */
  id: string;
  /** Human-readable description from skill registry */
  description: string;
  /** Slash command alias, e.g. "/commitments" */
  command: string;
  /** Whether the skill is live or planned */
  status: "active" | "planned";
  /** Example phrases that should trigger this skill */
  triggerExamples: string[];
  /** Input fields the skill requires */
  requiredInputs: string[];
  /** Prompt to show when required inputs are missing */
  fallbackPrompt: string;
  /** Derived at index time: tokenized keywords from description + triggers */
  keywords: string[];
  /** Derived at index time: keywords unique to other skills (negative signal) */
  antiKeywords: string[];
}

// ── Router input ────────────────────────────────────────────────────

export interface RouterInput {
  /** The user's natural-language message */
  userMessage: string;
  /** Keys the user has already provided (e.g. ["transcript"]) */
  availableInputs?: string[];
  /** Recent conversation for multi-turn disambiguation */
  recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
}

// ── Router output ───────────────────────────────────────────────────

export type DecisionType = "NO_SKILL" | "SUGGEST_SKILL" | "ASK_CLARIFY";

export interface ScoredSkill {
  skillId: string;
  /** Normalized confidence score, 0.0–1.0 */
  score: number;
  /** One-sentence conversational rationale */
  rationale: string;
  /** Slash command to run this skill */
  command: string;
  /** Required inputs the user hasn't provided yet */
  missingInputs: string[];
}

export interface RouterDecision {
  decision: DecisionType;
  /** Present when decision === "SUGGEST_SKILL". Top candidate first. */
  suggestions?: ScoredSkill[];
  /** Present when decision === "ASK_CLARIFY". Exactly one question. */
  clarifyQuestion?: string;
  /** Skill IDs being disambiguated */
  clarifyAmong?: string[];
  /** Which scoring engine produced this result */
  engine: "keyword" | "llm";
  /** Time taken in milliseconds */
  latencyMs: number;
}

// ── Router config (subset of WrapperConfig) ─────────────────────────

export interface RouterConfig {
  enabled: boolean;
  /** Whether to escalate uncertain v0 scores to LLM */
  llmEscalation: boolean;
  /** How long to cache the skill catalog, in seconds */
  cacheTTLSeconds: number;
}

// ── LLM router response (v1 escalation) ─────────────────────────────

export interface LLMRouterResponse {
  best_match: string | null;
  confidence: number;
  rationale: string;
  runner_up: string | null;
  runner_up_confidence: number;
}

// Re-export LLMClient so router modules can import from one place
export type { LLMClient };
