import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateRedteamInput,
  validateRedteamOutput,
} from "../../validators/redteam.js";
import { normalizeOutput } from "./mapper.js";
import type {
  LLMClient,
  RedteamInput,
  RunResult,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let _systemPrompt: string | null = null;
let _userTemplate: string | null = null;
let _outputSchemaText: string | null = null;

function loadSystemPrompt(): string {
  if (!_systemPrompt) {
    _systemPrompt = readFileSync(resolve(__dirname, "prompt.system.md"), "utf-8");
  }
  return _systemPrompt;
}

function loadUserTemplate(): string {
  if (!_userTemplate) {
    _userTemplate = readFileSync(resolve(__dirname, "prompt.user.template.md"), "utf-8");
  }
  return _userTemplate;
}

function loadOutputSchema(): string {
  if (!_outputSchemaText) {
    _outputSchemaText = readFileSync(
      resolve(__dirname, "../../../skills/redteam/schemas/output.schema.json"),
      "utf-8",
    );
  }
  return _outputSchemaText;
}

function buildContextBlock(input: RedteamInput): string {
  const parts: string[] = [];

  if (input.context) {
    parts.push(`- **Context:** ${input.context}`);
  }
  if (input.audience) {
    parts.push(`- **Audience:** ${input.audience}`);
  }
  if (input.risk_tolerance) {
    parts.push(`- **Risk tolerance:** ${input.risk_tolerance}`);
  }
  if (input.focus_idea) {
    parts.push(`- **Focus idea to stress-test:** ${input.focus_idea}`);
  }
  if (input.focus_questions && input.focus_questions.length > 0) {
    parts.push("- **Focus questions:**");
    for (const q of input.focus_questions) {
      parts.push(`  - ${q}`);
    }
  }
  if (input.constraints && input.constraints.length > 0) {
    parts.push("- **Constraints:**");
    for (const c of input.constraints) {
      parts.push(`  - ${c}`);
    }
  }

  if (parts.length === 0) return "";
  return `## Analysis Context\n\n${parts.join("\n")}`;
}

function detectMode(input: RedteamInput): "transcript_only" | "transcript_plus_focus" {
  if (
    input.focus_idea !== undefined ||
    (input.focus_questions !== undefined && input.focus_questions.length > 0)
  ) {
    return "transcript_plus_focus";
  }
  return "transcript_only";
}

function buildUserPrompt(input: RedteamInput): string {
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

function parseJsonSafely(text: string): { data: unknown; error?: string } {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  cleaned = cleaned.trim();
  try {
    return { data: JSON.parse(cleaned) };
  } catch {
    return { data: null, error: `LLM returned invalid JSON: ${cleaned.slice(0, 120)}…` };
  }
}

export async function runRedteam(
  input: unknown,
  client: LLMClient,
): Promise<RunResult> {
  const inputResult = validateRedteamInput(input);
  if (!inputResult.valid) {
    return {
      ok: false,
      error: {
        stage: "input_validation",
        message: "Input does not conform to redteam input schema",
        details: inputResult.errors,
      },
    };
  }

  const typedInput = input as RedteamInput;
  const systemPrompt = loadSystemPrompt();
  const userPrompt = buildUserPrompt(typedInput);

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

  const parsed = parseJsonSafely(llmResponse);
  if (parsed.error) {
    return { ok: false, error: { stage: "json_parse", message: parsed.error } };
  }

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

  const outputResult = validateRedteamOutput(normalized.output);
  if (!outputResult.valid) {
    return {
      ok: false,
      error: {
        stage: "output_validation",
        message: "Output failed schema validation after normalization",
        details: outputResult.errors,
      },
    };
  }

  const lowConfidence = normalized.output.failure_modes
    .filter((fm) => fm.severity <= 2 && fm.likelihood <= 2)
    .map((fm) => fm.id);

  return {
    ok: true,
    data: normalized.output,
    diagnostics: {
      warnings: normalized.warnings,
      low_confidence_failure_modes: lowConfidence,
      inferred_fields: normalized.inferred_fields,
    },
  };
}
