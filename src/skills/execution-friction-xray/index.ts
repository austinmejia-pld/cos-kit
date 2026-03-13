import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateExecutionFrictionXrayInput,
  validateExecutionFrictionXrayOutput,
} from "../../validators/executionFrictionXray.js";
import { normalizeOutput } from "./mapper.js";
import type {
  LLMClient,
  ExecutionFrictionXrayInput,
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
      "../../../schemas/execution-friction-xray.output.schema.json",
    );
    _outputSchemaText = readFileSync(schemaPath, "utf-8");
  }
  return _outputSchemaText;
}

// ── Prompt builder ──────────────────────────────────────────────────

function buildContextBlock(input: ExecutionFrictionXrayInput): string {
  const parts: string[] = [];

  if (input.meeting_title) {
    parts.push(`- **Meeting title:** ${input.meeting_title}`);
  }
  if (input.meeting_datetime) {
    parts.push(`- **Meeting datetime:** ${input.meeting_datetime}`);
  }
  if (input.team_context) {
    parts.push(`- **Team context:** ${input.team_context}`);
  }
  if (input.focus_area) {
    parts.push(
      `- **Focus area:** ${input.focus_area} (prioritize friction related to this area)`,
    );
  }
  if (input.urgency_level) {
    parts.push(`- **Urgency level:** ${input.urgency_level}`);
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
  input: ExecutionFrictionXrayInput,
): "transcript_only" | "transcript_plus_context" {
  if (
    input.meeting_title !== undefined ||
    input.meeting_datetime !== undefined ||
    input.team_context !== undefined ||
    input.focus_area !== undefined ||
    input.urgency_level !== undefined ||
    input.analysis_depth !== undefined ||
    (input.participant_directory !== undefined &&
      input.participant_directory.length > 0) ||
    (input.key_questions !== undefined && input.key_questions.length > 0)
  ) {
    return "transcript_plus_context";
  }
  return "transcript_only";
}

function buildUserPrompt(input: ExecutionFrictionXrayInput): string {
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

export async function runExecutionFrictionXray(
  input: unknown,
  client: LLMClient,
): Promise<RunResult> {
  // 1. Validate input
  const inputResult = validateExecutionFrictionXrayInput(input);
  if (!inputResult.valid) {
    return {
      ok: false,
      error: {
        stage: "input_validation",
        message: "Input does not conform to execution-friction-xray input schema",
        details: inputResult.errors,
      },
    };
  }

  const typedInput = input as ExecutionFrictionXrayInput;

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
  const outputResult = validateExecutionFrictionXrayOutput(normalized.output);
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
  const lowConfidenceHotspots = normalized.output.friction_hotspots
    .filter((h) => h.severity <= 2 && h.likelihood <= 2)
    .map((h) => h.id);

  return {
    ok: true,
    data: normalized.output,
    diagnostics: {
      warnings: normalized.warnings,
      low_confidence_hotspots: lowConfidenceHotspots,
      inferred_fields: normalized.inferred_fields,
    },
  };
}
