import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateDecisionQualityAuditInput,
  validateDecisionQualityAuditOutput,
} from "../../validators/decisionQualityAudit.js";
import { normalizeOutput } from "./mapper.js";
import type {
  LLMClient,
  DecisionQualityAuditInput,
  RunResult,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Lazy-loaded prompt assets (read once, cached) ───────────────────

let _systemPrompt: string | null = null;
let _userTemplate: string | null = null;
let _outputSchemaText: string | null = null;

function loadSystemPrompt(): string {
  if (!_systemPrompt) {
    _systemPrompt = readFileSync(
      resolve(__dirname, "prompt.system.md"),
      "utf-8",
    );
  }
  return _systemPrompt;
}

function loadUserTemplate(): string {
  if (!_userTemplate) {
    _userTemplate = readFileSync(
      resolve(__dirname, "prompt.user.template.md"),
      "utf-8",
    );
  }
  return _userTemplate;
}

function loadOutputSchema(): string {
  if (!_outputSchemaText) {
    const schemaPath = resolve(
      __dirname,
      "../../../schemas/decision-quality-audit.output.schema.json",
    );
    _outputSchemaText = readFileSync(schemaPath, "utf-8");
  }
  return _outputSchemaText;
}

// ── Prompt builder ──────────────────────────────────────────────────

function buildContextBlock(input: DecisionQualityAuditInput): string {
  const parts: string[] = [];

  if (input.meeting_title) {
    parts.push(`- **Meeting title:** ${input.meeting_title}`);
  }
  if (input.meeting_datetime) {
    parts.push(`- **Meeting datetime:** ${input.meeting_datetime}`);
  }
  if (input.decision_focus) {
    parts.push(
      `- **Decision focus:** ${input.decision_focus} (center the audit on this decision)`,
    );
  }
  if (input.strategic_context) {
    parts.push(`- **Strategic context:** ${input.strategic_context}`);
  }
  if (input.risk_tolerance) {
    parts.push(`- **Risk tolerance:** ${input.risk_tolerance}`);
  }
  if (input.analysis_depth) {
    parts.push(`- **Analysis depth:** ${input.analysis_depth}`);
  }
  if (input.participant_directory && input.participant_directory.length > 0) {
    parts.push("- **Participant directory:**");
    for (const p of input.participant_directory) {
      parts.push(`  - ${p.name} — ${p.role}, ${p.team}`);
    }
  }
  if (input.key_questions && input.key_questions.length > 0) {
    parts.push("- **Key questions to address:**");
    for (const q of input.key_questions) {
      parts.push(`  - ${q}`);
    }
  }

  if (parts.length === 0) return "";
  return `## Context\n\n${parts.join("\n")}`;
}

function detectMode(
  input: DecisionQualityAuditInput,
): "transcript_only" | "transcript_plus_context" {
  if (
    input.meeting_title !== undefined ||
    input.meeting_datetime !== undefined ||
    input.decision_focus !== undefined ||
    input.strategic_context !== undefined ||
    input.risk_tolerance !== undefined ||
    input.analysis_depth !== undefined ||
    (input.participant_directory !== undefined &&
      input.participant_directory.length > 0) ||
    (input.key_questions !== undefined && input.key_questions.length > 0)
  ) {
    return "transcript_plus_context";
  }
  return "transcript_only";
}

function buildUserPrompt(input: DecisionQualityAuditInput): string {
  const template = loadUserTemplate();
  const contextBlock = buildContextBlock(input);
  const schemaText = loadOutputSchema();
  const mode = detectMode(input);

  return template
    .replace("{{transcript}}", input.transcript)
    .replace("{{context_block}}", contextBlock)
    .replace("{{output_schema}}", schemaText)
    .replace("{{mode_used}}", mode);
}

// ── JSON parsing (fence-strip + parse) ──────────────────────────────

function parseJsonSafely(text: string): { data: unknown; error?: string } {
  let cleaned = text.trim();
  cleaned = cleaned
    .replace(/^```(?:json)?\s*\n?/, "")
    .replace(/\n?\s*```$/, "");
  cleaned = cleaned.trim();

  try {
    return { data: JSON.parse(cleaned) };
  } catch {
    return {
      data: null,
      error: `LLM returned invalid JSON: ${cleaned.slice(0, 120)}…`,
    };
  }
}

// ── Main entry point ────────────────────────────────────────────────

export async function runDecisionQualityAudit(
  input: unknown,
  client: LLMClient,
): Promise<RunResult> {
  // 1. Validate input
  const inputResult = validateDecisionQualityAuditInput(input);
  if (!inputResult.valid) {
    return {
      ok: false,
      error: {
        stage: "input_validation",
        message: "Input does not conform to decision-quality-audit input schema",
        details: inputResult.errors,
      },
    };
  }

  const typedInput = input as DecisionQualityAuditInput;

  // 2. Build prompts
  const systemPrompt = loadSystemPrompt();
  const userPrompt = buildUserPrompt(typedInput);

  // 3. Call LLM
  let llmResponse: string;
  try {
    llmResponse = await client.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
  } catch (err) {
    return {
      ok: false,
      error: {
        stage: "llm_call",
        message: `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  // 4. Parse JSON
  const parsed = parseJsonSafely(llmResponse);
  if (parsed.error) {
    return {
      ok: false,
      error: {
        stage: "json_parse",
        message: parsed.error,
      },
    };
  }

  // 5. Normalize via mapper
  let normalized;
  try {
    normalized = normalizeOutput(parsed.data, typedInput);
  } catch (err) {
    return {
      ok: false,
      error: {
        stage: "normalization",
        message: `Normalization failed: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  // 6. Validate output
  const outputResult = validateDecisionQualityAuditOutput(normalized.output);
  if (!outputResult.valid) {
    return {
      ok: false,
      error: {
        stage: "output_validation",
        message:
          "Output failed schema validation after normalization",
        details: outputResult.errors,
      },
    };
  }

  // 7. Build diagnostics
  const breakdown = normalized.output.score_breakdown;
  const lowConfidenceSections: string[] = [];
  const dimensionEntries: [string, number][] = [
    ["clarity_of_decision", breakdown.clarity_of_decision],
    ["evidence_quality", breakdown.evidence_quality],
    ["alternatives_considered", breakdown.alternatives_considered],
    ["risk_assessment_quality", breakdown.risk_assessment_quality],
    ["ownership_and_accountability", breakdown.ownership_and_accountability],
    ["reversibility_and_checkpoints", breakdown.reversibility_and_checkpoints],
  ];
  for (const [name, score] of dimensionEntries) {
    if (score < 40) {
      lowConfidenceSections.push(name);
    }
  }

  return {
    ok: true,
    data: normalized.output,
    diagnostics: {
      warnings: normalized.warnings,
      low_confidence_sections: lowConfidenceSections,
      inferred_fields: normalized.inferred_fields,
    },
  };
}
