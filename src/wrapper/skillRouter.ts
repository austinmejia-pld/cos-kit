/**
 * Skill routing engine — matches user natural-language input to the
 * best skill and returns a conversational suggestion.
 *
 * Never auto-executes. Suggests only.
 */

import type {
  SkillMeta,
  RouterInput,
  RouterDecision,
  ScoredSkill,
  LLMClient,
  LLMRouterResponse,
} from "./routerTypes.js";
import {
  tokenize,
  bestTriggerMatch,
  keywordOverlap,
  antiKeywordPenalty,
  signalPhraseDensity,
} from "./textUtils.js";

// ── Input mode detection ────────────────────────────────────────────

const TRANSCRIPT_CHAR_THRESHOLD = 500;

// ── Scoring weights: short-query mode (original) ────────────────────

const W_TRIGGER = 0.50;
const W_KEYWORD = 0.35;
const W_ANTI = 0.15;

// ── Scoring weights: transcript mode ────────────────────────────────

const W_SIGNAL = 0.50;
const W_KEYWORD_TX = 0.35;
const W_ANTI_TX = 0.15;

// ── Thresholds ──────────────────────────────────────────────────────

const THRESHOLD_CONFIDENT = 0.70;
const THRESHOLD_MODERATE = 0.50;
const THRESHOLD_LOW = 0.35;
const TIE_GAP = 0.15;

// ── v1 escalation zone ─────────────────────────────────────────────

const V1_FLOOR = 0.25;
const V1_CEILING = 0.65;
const V1_TIMEOUT_MS = 3000;

// ── Core routing function ───────────────────────────────────────────

export async function routeSkill(
  input: RouterInput,
  catalog: SkillMeta[],
  llmClient?: LLMClient,
  llmEscalation = false,
): Promise<RouterDecision> {
  const start = Date.now();

  // Filter to active skills only
  const active = catalog.filter((s) => s.status === "active");
  if (active.length === 0) {
    return { decision: "NO_SKILL", engine: "keyword", latencyMs: Date.now() - start };
  }

  const messageTokens = tokenize(input.userMessage);
  const isTranscript = input.userMessage.length >= TRANSCRIPT_CHAR_THRESHOLD;

  // v0: score all active skills (mode-aware)
  const scoreFn = isTranscript ? computeTranscriptScore : computeV0Score;
  let scores: ScoredSkill[] = active.map((skill) => ({
    skillId: skill.id,
    score: scoreFn(input.userMessage, messageTokens, skill),
    rationale: "",
    command: skill.command,
    missingInputs: computeMissingInputs(
      skill.requiredInputs,
      input.availableInputs ?? [],
    ),
  }));

  scores.sort((a, b) => b.score - a.score);
  let engine: "keyword" | "llm" = "keyword";

  // v1: escalate if uncertain and LLM available
  const top = scores[0];
  if (
    llmEscalation &&
    llmClient &&
    top.score >= V1_FLOOR &&
    top.score <= V1_CEILING
  ) {
    try {
      const v1Result = await callLLMRouter(
        input.userMessage,
        active,
        llmClient,
      );
      if (v1Result) {
        applyV1Scores(scores, v1Result);
        scores.sort((a, b) => b.score - a.score);
        engine = "llm";
      }
    } catch {
      // LLM failed — continue with v0 scores
    }
  }

  const decision = applyThresholds(scores, input, engine);
  decision.latencyMs = Date.now() - start;
  return decision;
}

// ── v0 scoring: short-query mode ─────────────────────────────────────

function computeV0Score(
  message: string,
  messageTokens: string[],
  skill: SkillMeta,
): number {
  const trigger = bestTriggerMatch(message, skill.triggerExamples);
  const keywords = keywordOverlap(messageTokens, skill.keywords);
  const anti = antiKeywordPenalty(messageTokens, skill.antiKeywords);

  return trigger * W_TRIGGER + keywords * W_KEYWORD + anti * W_ANTI;
}

// ── v0 scoring: transcript mode ──────────────────────────────────────

function computeTranscriptScore(
  message: string,
  messageTokens: string[],
  skill: SkillMeta,
): number {
  const signal = signalPhraseDensity(message, skill.signalPhrases);
  const keywords = keywordOverlap(messageTokens, skill.keywords);
  const anti = antiKeywordPenalty(messageTokens, skill.antiKeywords);

  return signal * W_SIGNAL + keywords * W_KEYWORD_TX + anti * W_ANTI_TX;
}

function computeMissingInputs(
  required: string[],
  available: string[],
): string[] {
  const availSet = new Set(available);
  return required.filter((r) => !availSet.has(r));
}

// ── Thresholding & decision logic ───────────────────────────────────

function applyThresholds(
  scores: ScoredSkill[],
  input: RouterInput,
  engine: "keyword" | "llm",
): RouterDecision {
  const top = scores[0];
  const runnerUp = scores[1];
  const gap = top.score - (runnerUp?.score ?? 0);

  // Below minimum — no match
  if (top.score < THRESHOLD_LOW) {
    return { decision: "NO_SKILL", engine, latencyMs: 0 };
  }

  // Tie zone: both above moderate, gap < TIE_GAP
  if (
    top.score >= THRESHOLD_MODERATE &&
    gap < TIE_GAP &&
    (runnerUp?.score ?? 0) >= THRESHOLD_MODERATE
  ) {
    // Attempt tie-break
    const winner = tieBreak(top, runnerUp!, input);
    if (winner) {
      winner.rationale = buildRationale(winner, true);
      return { decision: "SUGGEST_SKILL", suggestions: [winner], engine, latencyMs: 0 };
    }
    // Cannot break tie — ask user
    return {
      decision: "ASK_CLARIFY",
      clarifyQuestion: buildClarifyQuestion(top, runnerUp!),
      clarifyAmong: [top.skillId, runnerUp!.skillId],
      engine,
      latencyMs: 0,
    };
  }

  // Confident or moderate match with clear gap
  if (top.score >= THRESHOLD_MODERATE) {
    top.rationale = buildRationale(top, top.score >= THRESHOLD_CONFIDENT);
    return { decision: "SUGGEST_SKILL", suggestions: [top], engine, latencyMs: 0 };
  }

  // Low confidence zone (0.35–0.49): show top 2
  top.rationale = buildRationale(top, false);
  const suggestions = [top];
  if (runnerUp && runnerUp.score >= THRESHOLD_LOW) {
    runnerUp.rationale = buildRationale(runnerUp, false);
    suggestions.push(runnerUp);
  }
  return { decision: "SUGGEST_SKILL", suggestions, engine, latencyMs: 0 };
}

// ── Tie-breaking ────────────────────────────────────────────────────

function tieBreak(
  a: ScoredSkill,
  b: ScoredSkill,
  input: RouterInput,
): ScoredSkill | null {
  const availSet = new Set(input.availableInputs ?? []);

  // 1. Prefer skill with more required inputs already available
  const aReady = a.missingInputs.length === 0 ? 1 : 0;
  const bReady = b.missingInputs.length === 0 ? 1 : 0;
  if (aReady !== bReady) return aReady > bReady ? a : b;

  // 2. Prefer fewer missing inputs
  if (a.missingInputs.length !== b.missingInputs.length) {
    return a.missingInputs.length < b.missingInputs.length ? a : b;
  }

  // Cannot break tie
  return null;
}

// ── Rationale & suggestion formatting ───────────────────────────────

function buildRationale(skill: ScoredSkill, confident: boolean): string {
  const pct = Math.round(skill.score * 100);
  if (confident) {
    return `Matched with ${pct}% confidence`;
  }
  return `Possible match (${pct}% confidence)`;
}

function buildClarifyQuestion(a: ScoredSkill, b: ScoredSkill): string {
  return `Are you looking to use **${a.command}** or **${b.command}**?`;
}

/**
 * Format a RouterDecision into conversational text for the user.
 */
export function formatSuggestion(
  decision: RouterDecision,
  catalog: SkillMeta[],
): string {
  if (decision.decision === "NO_SKILL") {
    return "";
  }

  if (decision.decision === "ASK_CLARIFY") {
    const skills = (decision.clarifyAmong ?? [])
      .map((id) => catalog.find((s) => s.id === id))
      .filter(Boolean) as SkillMeta[];

    if (skills.length === 2) {
      return (
        `A couple of skills might help here:\n` +
        `- **${skills[0].command}** — ${truncate(skills[0].description, 80)}\n` +
        `- **${skills[1].command}** — ${truncate(skills[1].description, 80)}\n\n` +
        `Which sounds closer to what you need?`
      );
    }
    return decision.clarifyQuestion ?? "";
  }

  // SUGGEST_SKILL
  const suggestions = decision.suggestions ?? [];
  if (suggestions.length === 0) return "";

  if (suggestions.length === 1) {
    const s = suggestions[0];
    const skill = catalog.find((sk) => sk.id === s.skillId);
    const desc = skill ? truncate(skill.description, 100) : "";
    const confident = s.score >= THRESHOLD_CONFIDENT;

    let text = confident
      ? `Looks like you want to run **${s.command}**.`
      : `You might want **${s.command}**.`;

    if (desc) text += ` ${desc}`;
    text += `\n\nTo proceed, run: \`${s.command}\``;

    if (s.missingInputs.length > 0) {
      text += `\nYou'll need: ${s.missingInputs.join(", ")}.`;
    }

    return text;
  }

  // Multiple suggestions
  let text = "A couple of skills might help here:\n";
  for (const s of suggestions) {
    const skill = catalog.find((sk) => sk.id === s.skillId);
    const desc = skill ? truncate(skill.description, 60) : "";
    text += `- **${s.command}** — ${desc}\n`;
  }
  text += "\nWhich sounds closer to what you need?";
  return text;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

// ── v1 LLM escalation ──────────────────────────────────────────────

async function callLLMRouter(
  message: string,
  skills: SkillMeta[],
  client: LLMClient,
): Promise<LLMRouterResponse | null> {
  const skillList = skills
    .map(
      (s) =>
        `- id: ${s.id}\n  description: ${truncate(s.description, 120)}\n  triggers: ${s.triggerExamples.join(", ")}`,
    )
    .join("\n");

  const systemPrompt = `You are a skill routing assistant. Given a user message, determine which skill (if any) best matches. Respond with ONLY valid JSON, no markdown fences.

Available skills:
${skillList}

Respond with this exact JSON structure:
{"best_match": "<skill-id or null>", "confidence": <0.0-1.0>, "rationale": "<one sentence>", "runner_up": "<skill-id or null>", "runner_up_confidence": <0.0-1.0 or 0>}`;

  const response = await Promise.race([
    client.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ]),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("LLM router timeout")), V1_TIMEOUT_MS),
    ),
  ]);

  try {
    const cleaned = response.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as LLMRouterResponse;
  } catch {
    return null;
  }
}

function applyV1Scores(
  scores: ScoredSkill[],
  v1: LLMRouterResponse,
): void {
  if (v1.best_match) {
    const match = scores.find((s) => s.skillId === v1.best_match);
    if (match) {
      match.score = v1.confidence;
      match.rationale = v1.rationale;
    }
  }
  if (v1.runner_up) {
    const runnerUp = scores.find((s) => s.skillId === v1.runner_up);
    if (runnerUp) {
      runnerUp.score = v1.runner_up_confidence;
    }
  }
}
