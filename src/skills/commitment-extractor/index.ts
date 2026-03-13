import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateCommitmentExtractorInput,
  validateCommitmentExtractorOutput,
} from "../../validators/commitmentExtractor.js";
import { normalizeOutput } from "./mapper.js";
import type {
  LLMClient,
  CommitmentExtractorInput,
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
      "../../../skills/commitment-extractor/schemas/output.schema.json",
    );
    _outputSchemaText = readFileSync(schemaPath, "utf-8");
  }
  return _outputSchemaText;
}

// ── Prompt builder ──────────────────────────────────────────────────

function buildContextBlock(input: CommitmentExtractorInput): string {
  const parts: string[] = [];

  if (input.meeting_title) {
    parts.push(`- **Meeting title:** ${input.meeting_title}`);
  }
  if (input.meeting_datetime) {
    parts.push(`- **Meeting datetime:** ${input.meeting_datetime}`);
  }
  if (input.default_timezone) {
    parts.push(`- **Default timezone:** ${input.default_timezone}`);
  }
  if (input.focus_person) {
    parts.push(
      `- **Focus person:** ${input.focus_person} (prioritize commitments for this person)`,
    );
  }
  if (input.extraction_mode) {
    parts.push(`- **Extraction mode:** ${input.extraction_mode}`);
  }
  if (input.include_non_actionable !== undefined) {
    parts.push(
      `- **Include non-actionable:** ${String(input.include_non_actionable)}`,
    );
  }
  if (input.participant_directory && input.participant_directory.length > 0) {
    parts.push("- **Participant directory:**");
    for (const p of input.participant_directory) {
      parts.push(`  - ${p.name} — ${p.role}, ${p.team}`);
    }
  }

  if (parts.length === 0) return "";
  return `## Context\n\n${parts.join("\n")}`;
}

function detectMode(
  input: CommitmentExtractorInput,
): "transcript_only" | "transcript_plus_context" {
  if (
    input.meeting_title !== undefined ||
    input.meeting_datetime !== undefined ||
    input.default_timezone !== undefined ||
    (input.participant_directory !== undefined &&
      input.participant_directory.length > 0) ||
    input.focus_person !== undefined ||
    input.extraction_mode !== undefined ||
    input.include_non_actionable !== undefined
  ) {
    return "transcript_plus_context";
  }
  return "transcript_only";
}

function buildUserPrompt(input: CommitmentExtractorInput): string {
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
  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  cleaned = cleaned.trim();

  try {
    return { data: JSON.parse(cleaned) };
  } catch {
    return { data: null, error: `LLM returned invalid JSON: ${cleaned.slice(0, 120)}…` };
  }
}

// ── Main entry point ────────────────────────────────────────────────

export async function runCommitmentExtractor(
  input: unknown,
  client: LLMClient,
): Promise<RunResult> {
  // 1. Validate input
  const inputResult = validateCommitmentExtractorInput(input);
  if (!inputResult.valid) {
    return {
      ok: false,
      error: "Input validation failed",
      validation_errors: inputResult.errors,
    };
  }

  const typedInput = input as CommitmentExtractorInput;

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
      error: `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // 4. Parse JSON
  const parsed = parseJsonSafely(llmResponse);
  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }

  // 5. Normalize via mapper
  const { output: normalized, warnings } = normalizeOutput(
    parsed.data,
    typedInput,
  );

  // 6. Validate output
  const outputResult = validateCommitmentExtractorOutput(normalized);
  if (!outputResult.valid) {
    return {
      ok: false,
      error: "Output failed schema validation after normalization",
      validation_errors: outputResult.errors,
    };
  }

  // 7. Build diagnostics
  const lowConfidence = normalized.commitments
    .filter((c) => c.confidence_score < 0.5)
    .map((c) => c.id);

  return {
    ok: true,
    data: normalized,
    diagnostics: {
      warnings,
      low_confidence_commitments: lowConfidence,
    },
  };
}
