import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateMeetingRiskAnalysisInput,
  validateMeetingRiskAnalysisOutput,
} from "../../validators/meetingRiskAnalysis.js";
import { normalizeOutput } from "./mapper.js";
import type {
  LLMClient,
  MeetingRiskAnalysisInput,
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
      resolve(__dirname, "../../../skills/meeting-risk-analysis/schemas/output.schema.json"),
      "utf-8",
    );
  }
  return _outputSchemaText;
}

function buildContextBlock(input: MeetingRiskAnalysisInput): string {
  const parts: string[] = [];
  const ctx = input.context;
  if (ctx.prior_decisions && ctx.prior_decisions.length > 0) {
    parts.push("- **Prior decisions:** " + ctx.prior_decisions.join("; "));
  }
  if (ctx.known_constraints && ctx.known_constraints.length > 0) {
    parts.push("- **Known constraints:** " + ctx.known_constraints.join("; "));
  }
  if (ctx.strategic_goals && ctx.strategic_goals.length > 0) {
    parts.push("- **Strategic goals:** " + ctx.strategic_goals.join("; "));
  }
  if (parts.length === 0) return "";
  return `## Context\n\n${parts.join("\n")}`;
}

function buildUserPrompt(input: MeetingRiskAnalysisInput): string {
  const template = loadUserTemplate();
  const contextBlock = buildContextBlock(input);
  const schemaText = loadOutputSchema();

  const participantsBlock = input.participants.map((p) => `- ${p}`).join("\n");

  const meetingDateLine = input.meeting_date
    ? `- **Meeting Date:** ${input.meeting_date}`
    : "";

  const objectivesBlock =
    input.objectives && input.objectives.length > 0
      ? `## Objectives\n\n${input.objectives.map((o) => `- ${o}`).join("\n")}`
      : "";

  return template
    .replace("{{meeting_id}}", input.meeting_id)
    .replace("{{meeting_title}}", input.meeting_title)
    .replace("{{meeting_date_line}}", meetingDateLine)
    .replace("{{participants_block}}", participantsBlock)
    .replace("{{context_block}}", contextBlock)
    .replace("{{objectives_block}}", objectivesBlock)
    .replace("{{transcript}}", input.transcript)
    .replace("{{output_schema}}", schemaText);
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

export async function runMeetingRiskAnalysis(
  input: unknown,
  client: LLMClient,
): Promise<RunResult> {
  const inputResult = validateMeetingRiskAnalysisInput(input);
  if (!inputResult.valid) {
    return {
      ok: false,
      error: {
        stage: "input_validation",
        message: "Input does not conform to meeting-risk-analysis input schema",
        details: inputResult.errors,
      },
    };
  }

  const typedInput = input as MeetingRiskAnalysisInput;
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

  const outputResult = validateMeetingRiskAnalysisOutput(normalized.output);
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

  return {
    ok: true,
    data: normalized.output,
    diagnostics: {
      warnings: normalized.warnings,
    },
  };
}
