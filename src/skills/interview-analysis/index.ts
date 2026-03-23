import { readFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateInterviewAnalysisInput,
  validateInterviewAnalysisOutput,
} from "../../validators/interviewAnalysis.js";
import { normalizeOutput } from "./mapper.js";
import type {
  LLMClient,
  InterviewAnalysisInput,
  RunResult,
} from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEBUG_LOG =
  "/Users/austinmejia/OpenClaw Custom App/.cursor/debug-b71ae0.log";

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
      resolve(__dirname, "../../../skills/interview-analysis/schemas/output.schema.json"),
      "utf-8",
    );
  }
  return _outputSchemaText;
}

function buildRubricBlock(input: InterviewAnalysisInput): string {
  const lines: string[] = [];
  for (const dim of input.rubric.dimensions) {
    lines.push(`### ${dim.name}${dim.must_have ? " (MUST-HAVE)" : ""}`);
    lines.push(`${dim.description}`);
    lines.push(`Scale: ${dim.scale_min}-${dim.scale_max}`);
    if (dim.anchors && dim.anchors.length > 0) {
      lines.push("Anchors:");
      for (const a of dim.anchors) {
        lines.push(`  - ${a.score}: ${a.definition}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildUserPrompt(input: InterviewAnalysisInput): string {
  const template = loadUserTemplate();
  const rubricBlock = buildRubricBlock(input);
  const schemaText = loadOutputSchema();

  const interviewerLine = input.interviewer
    ? `- **Interviewer:** ${input.interviewer}`
    : "";

  const interviewDateLine = input.interview_date
    ? `- **Interview Date:** ${input.interview_date}`
    : "";

  const mustHaveBlock =
    input.must_have_requirements && input.must_have_requirements.length > 0
      ? `## Must-Have Requirements\n\n${input.must_have_requirements.map((r) => `- ${r}`).join("\n")}`
      : "";

  return template
    .replace("{{candidate_name}}", input.candidate_name)
    .replace("{{role}}", input.role)
    .replace("{{stage}}", input.stage)
    .replace("{{interviewer_line}}", interviewerLine)
    .replace("{{interview_date_line}}", interviewDateLine)
    .replace("{{must_have_block}}", mustHaveBlock)
    .replace("{{rubric_block}}", rubricBlock)
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

export async function runInterviewAnalysis(
  input: unknown,
  client: LLMClient,
): Promise<RunResult> {
  // #region agent log
  try {
    const rec =
      input && typeof input === "object"
        ? (input as Record<string, unknown>)
        : null;
    appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({
        sessionId: "b71ae0",
        hypothesisId: "H3",
        location: "interview-analysis/index.ts:pre-validate",
        message: "input received by skill",
        data: {
          inputType: typeof input,
          keys: rec ? Object.keys(rec) : [],
        },
        timestamp: Date.now(),
      })}\n`,
    );
  } catch {
    /* ignore */
  }
  // #endregion

  const inputResult = validateInterviewAnalysisInput(input);
  if (!inputResult.valid) {
    return {
      ok: false,
      error: {
        stage: "input_validation",
        message: "Input does not conform to interview-analysis input schema",
        details: inputResult.errors,
      },
    };
  }

  const typedInput = input as InterviewAnalysisInput;
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

  const outputResult = validateInterviewAnalysisOutput(normalized.output);
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
