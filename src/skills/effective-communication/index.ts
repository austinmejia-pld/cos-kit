import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateEffectiveCommunicationInput,
  validateEffectiveCommunicationOutput,
} from "../../validators/effectiveCommunication.js";
import { normalizeOutput, detectMode, detectDepth } from "./mapper.js";
import { repairOutput } from "./repair.js";
import type {
  LLMClient,
  EffectiveCommunicationInput,
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
      "../../../schemas/effective-communication.output.schema.json",
    );
    _outputSchemaText = readFileSync(schemaPath, "utf-8");
  }
  return _outputSchemaText;
}

// ── Prompt builder ──────────────────────────────────────────────────

function buildContextBlock(input: EffectiveCommunicationInput): string {
  const parts: string[] = [];

  if (input.user_name) {
    parts.push(`- **Speaker being coached:** ${input.user_name}`);
  }
  if (input.communication_goal) {
    parts.push(`- **Communication goal:** ${input.communication_goal}`);
  }
  if (input.audience_context) {
    parts.push(`- **Audience context:** ${input.audience_context}`);
  }
  if (input.tone_target) {
    parts.push(`- **Target tone:** ${input.tone_target}`);
  }
  if (input.meeting_title) {
    parts.push(`- **Meeting title:** ${input.meeting_title}`);
  }
  if (input.meeting_datetime) {
    parts.push(`- **Meeting datetime:** ${input.meeting_datetime}`);
  }
  if (input.participant_directory && input.participant_directory.length > 0) {
    parts.push("- **Participant directory:**");
    for (const p of input.participant_directory) {
      parts.push(`  - ${p.name} — ${p.role}, ${p.team}`);
    }
  }
  if (input.focus_areas && input.focus_areas.length > 0) {
    parts.push(`- **Focus areas:** ${input.focus_areas.join(", ")}`);
  }
  if (input.key_questions && input.key_questions.length > 0) {
    parts.push("- **Key questions:**");
    for (const q of input.key_questions) {
      parts.push(`  - ${q}`);
    }
  }

  if (parts.length === 0) return "";
  return `## Context\n\n${parts.join("\n")}`;
}

function buildUserPrompt(input: EffectiveCommunicationInput): string {
  const template = loadUserTemplate();
  const contextBlock = buildContextBlock(input);
  const schemaText = loadOutputSchema();
  const mode = detectMode(input);
  const depth = detectDepth(input);

  return template
    .replace("{{transcript}}", input.transcript)
    .replace("{{context_block}}", contextBlock)
    .replace("{{output_schema}}", schemaText)
    .replace("{{mode_used}}", mode)
    .replace("{{analysis_depth}}", depth);
}

// ── JSON parsing (fence-strip + parse) ──────────────────────────────

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

// ── Main entry point ────────────────────────────────────────────────

export async function runEffectiveCommunication(
  input: unknown,
  client: LLMClient,
): Promise<RunResult> {
  // 1. Validate input
  const inputResult = validateEffectiveCommunicationInput(input);
  if (!inputResult.valid) {
    return {
      ok: false,
      error: "Input validation failed",
      validation_errors: inputResult.errors,
    };
  }

  const typedInput = input as EffectiveCommunicationInput;

  // 2. Build prompts
  const systemPrompt = loadSystemPrompt();
  const userPrompt = buildUserPrompt(typedInput);

  // 3. Call LLM (pass 1)
  let llmResponse: string;
  try {
    llmResponse = await client.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
  } catch (err) {
    return {
      ok: false,
      error: `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 4. Parse JSON (pass 1)
  let parsed = parseJsonSafely(llmResponse);
  let repairAttempted = false;

  if (parsed.error) {
    // Pass 1 JSON parse failed — attempt repair
    repairAttempted = true;
    const repairResult = await repairOutput(
      llmResponse,
      [{ path: "/", message: parsed.error, keyword: "type" }],
      client,
      systemPrompt,
    );
    if (repairResult.error) {
      return {
        ok: false,
        error: "Output failed JSON parsing after repair attempt",
        validation_errors: [{ path: "/", message: repairResult.error, keyword: "type" }],
        raw_response: llmResponse.slice(0, 500),
      };
    }
    parsed = { data: repairResult.data };
  }

  // 5. Normalize via mapper
  const { output: normalized, warnings } = normalizeOutput(
    parsed.data,
    typedInput,
  );

  // 6. Validate output (pass 1)
  let outputResult = validateEffectiveCommunicationOutput(normalized);

  if (!outputResult.valid && !repairAttempted) {
    // Pass 1 validation failed — attempt repair
    repairAttempted = true;
    const repairResult = await repairOutput(
      JSON.stringify(normalized, null, 2),
      outputResult.errors,
      client,
      systemPrompt,
    );

    if (repairResult.error) {
      return {
        ok: false,
        error: "Output failed schema validation after repair attempt",
        validation_errors: outputResult.errors,
        raw_response: llmResponse.slice(0, 500),
      };
    }

    // Re-normalize and re-validate the repaired output
    const { output: repairedNormalized, warnings: repairWarnings } =
      normalizeOutput(repairResult.data, typedInput);
    warnings.push(...repairWarnings);

    outputResult = validateEffectiveCommunicationOutput(repairedNormalized);
    if (!outputResult.valid) {
      return {
        ok: false,
        error: "Output failed schema validation after repair attempt",
        validation_errors: outputResult.errors,
        raw_response: llmResponse.slice(0, 500),
      };
    }

    return {
      ok: true,
      data: repairedNormalized,
      diagnostics: {
        warnings: [...warnings, "Output required repair pass"],
        repair_attempted: true,
      },
    };
  }

  if (!outputResult.valid) {
    // Both passes failed
    return {
      ok: false,
      error: "Output failed schema validation after repair attempt",
      validation_errors: outputResult.errors,
      raw_response: llmResponse.slice(0, 500),
    };
  }

  // 7. Success
  return {
    ok: true,
    data: normalized,
    diagnostics: {
      warnings,
      repair_attempted: repairAttempted,
    },
  };
}
