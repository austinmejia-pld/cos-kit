import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type {
  ParsedCommand,
  WrapperResult,
  WrapperConfig,
  LLMClient,
} from "./types.js";
import { formatInsight } from "./insightFormatter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

// ── Config ──────────────────────────────────────────────────────────

let _config: WrapperConfig | null = null;

export function loadConfig(configPath?: string): WrapperConfig {
  if (_config) return _config;
  const path =
    configPath ?? resolve(PROJECT_ROOT, "config/skill-wrapper.config.json");
  _config = JSON.parse(readFileSync(path, "utf-8")) as WrapperConfig;
  return _config;
}

export function resetConfig(): void {
  _config = null;
}

// ── Skill runner types ──────────────────────────────────────────────

type SkillRunner = (
  input: unknown,
  client: LLMClient,
) => Promise<{
  ok: boolean;
  data?: unknown;
  error?: unknown;
  diagnostics?: unknown;
}>;

export type SkillRunnerResolver = (
  skillName: string,
) => Promise<SkillRunner | null>;

// ── Default runner registry (dynamic imports) ───────────────────────

async function defaultResolveRunner(
  skillName: string,
): Promise<SkillRunner | null> {
  switch (skillName) {
    case "execution-friction-xray": {
      const { runExecutionFrictionXray } = await import(
        "../skills/execution-friction-xray/index.js"
      );
      return (input, client) => runExecutionFrictionXray(input, client);
    }
    case "commitment-extractor": {
      const { runCommitmentExtractor } = await import(
        "../skills/commitment-extractor/index.js"
      );
      return (input, client) => runCommitmentExtractor(input, client);
    }
    case "stakeholder-analysis":
      return createStakeholderAdapter();
    case "decision-quality-audit": {
      const { runDecisionQualityAudit } = await import(
        "../skills/decision-quality-audit/index.js"
      );
      return (input, client) => runDecisionQualityAudit(input, client);
    }
    case "redteam": {
      const { runRedteam } = await import(
        "../skills/redteam/index.js"
      );
      return (input, client) => runRedteam(input, client);
    }
    case "meeting-risk-analysis": {
      const { runMeetingRiskAnalysis } = await import(
        "../skills/meeting-risk-analysis/index.js"
      );
      return (input, client) => runMeetingRiskAnalysis(input, client);
    }
    case "interview-analysis": {
      const { runInterviewAnalysis } = await import(
        "../skills/interview-analysis/index.js"
      );
      return (input, client) => runInterviewAnalysis(input, client);
    }
    default:
      return null;
  }
}

// ── Stakeholder analysis adapter ────────────────────────────────────
// Bridges the LLMClient interface to runStakeholderAnalysis's
// (input, llmResponseJson: string) signature.

function createStakeholderAdapter(): SkillRunner {
  return async (input, client) => {
    const { runStakeholderAnalysis } = await import(
      "../skills/stakeholder-analysis/index.js"
    );

    const systemPrompt = readFileSync(
      resolve(__dirname, "../skills/stakeholder-analysis/prompt.system.md"),
      "utf-8",
    );
    const outputSchema = readFileSync(
      resolve(
        PROJECT_ROOT,
        "schemas/stakeholder-analysis.output.schema.json",
      ),
      "utf-8",
    );

    const typedInput = input as Record<string, unknown>;
    const userPrompt = buildStakeholderUserPrompt(typedInput, outputSchema);

    const llmResponse = await client.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    return runStakeholderAnalysis(input, llmResponse);
  };
}

function buildStakeholderUserPrompt(
  input: Record<string, unknown>,
  outputSchema: string,
): string {
  const parts: string[] = [];
  parts.push(
    "Analyze the following meeting transcript for stakeholder dynamics.",
  );
  parts.push(
    "Return ONLY valid JSON matching the output schema. No markdown fences.",
  );
  parts.push("");
  parts.push("## Transcript");
  parts.push("");
  parts.push(String(input.transcript ?? ""));

  if (input.focal_decision) {
    parts.push("", "## Focal Decision", String(input.focal_decision));
  }
  if (input.analysis_goal) {
    parts.push("", "## Analysis Goal", String(input.analysis_goal));
  }
  if (input.org_context) {
    parts.push("", "## Organizational Context", String(input.org_context));
  }
  if (
    Array.isArray(input.stakeholder_directory) &&
    input.stakeholder_directory.length > 0
  ) {
    parts.push(
      "",
      "## Known Stakeholders",
      JSON.stringify(input.stakeholder_directory, null, 2),
    );
  }
  if (
    Array.isArray(input.key_questions) &&
    input.key_questions.length > 0
  ) {
    parts.push("", "## Key Questions");
    for (const q of input.key_questions) {
      parts.push(`- ${String(q)}`);
    }
  }
  if (input.time_horizon) {
    parts.push("", `## Time Horizon: ${String(input.time_horizon)}`);
  }

  const hasContext = [
    "focal_decision",
    "analysis_goal",
    "org_context",
    "stakeholder_directory",
    "key_questions",
    "time_horizon",
    "confidence_threshold",
  ].some((k) => input[k] !== undefined);

  parts.push("", "## Output Schema", outputSchema, "");
  parts.push(
    `Set metadata.mode_used to "${hasContext ? "transcript_plus_context" : "transcript_only"}".`,
  );

  return parts.join("\n");
}

// ── Flag → input mapping ────────────────────────────────────────────

const FOCUS_FIELD_MAP: Record<string, string> = {
  "execution-friction-xray": "focus_area",
  "commitment-extractor": "focus_person",
  "stakeholder-analysis": "focal_decision",
  redteam: "focus_idea",
  "decision-quality-audit": "decision_focus",
  "meeting-risk-analysis": "focus_area",
  "interview-analysis": "focus_area",
};

function mapFlagsToInput(
  skillName: string,
  flags: ParsedCommand["flags"],
  baseInput: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...baseInput };

  if (flags.focus) {
    const focusField = FOCUS_FIELD_MAP[skillName] ?? "focus_area";
    merged[focusField] = flags.focus;
  }

  if (flags.depth) {
    merged.analysis_depth = flags.depth;
  }

  return merged;
}

// ── Artifact persistence ────────────────────────────────────────────

function persistArtifact(
  config: WrapperConfig,
  skillName: string,
  result: unknown,
): string {
  const artifactDir = resolve(PROJECT_ROOT, config.artifactDir);
  mkdirSync(artifactDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runId = randomUUID().slice(0, 8);
  const filename = `${skillName}-${timestamp}-${runId}.json`;
  const fullPath = resolve(artifactDir, filename);

  writeFileSync(fullPath, JSON.stringify(result, null, 2), "utf-8");
  return fullPath;
}

// ── Error extraction ────────────────────────────────────────────────

function extractErrorMessage(result: Record<string, unknown>): string {
  if (typeof result.error === "string") return result.error;
  if (result.error && typeof result.error === "object") {
    const err = result.error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
  }
  return "Unknown error";
}

// ── Main entry point ────────────────────────────────────────────────

export interface RunOptions {
  llmClient?: LLMClient;
  config?: WrapperConfig;
  resolveRunner?: SkillRunnerResolver;
}

export async function runSkillCommand(
  parsed: ParsedCommand,
  baseInput: Record<string, unknown>,
  options: RunOptions = {},
): Promise<WrapperResult> {
  // #region agent log
  fetch("http://127.0.0.1:7848/ingest/394e6945-2750-434f-bb8d-31c4f129abe1",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"6491c8"},body:JSON.stringify({sessionId:"6491c8",runId:"cmd-ui-check",hypothesisId:"H2",location:"src/wrapper/runSkillCommand.ts:271",message:"runSkillCommand entry",data:{recognized:parsed.recognized,skillName:parsed.skillName ?? null,flags:parsed.flags},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const config = options.config ?? loadConfig();

  if (!config.enabled) {
    return {
      ok: true,
      mode: "passthrough",
      content: "Skill wrapper is disabled.",
    };
  }

  if (!parsed.recognized || !parsed.skillName) {
    return {
      ok: false,
      mode: "error",
      content: parsed.error ?? "Unrecognized command.",
    };
  }

  const { skillName, flags } = parsed;
  const useRaw = flags.raw ?? config.exposeRawJsonByDefault;

  const resolve_ = options.resolveRunner ?? defaultResolveRunner;
  const runner = await resolve_(skillName);
  // #region agent log
  fetch("http://127.0.0.1:7848/ingest/394e6945-2750-434f-bb8d-31c4f129abe1",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"6491c8"},body:JSON.stringify({sessionId:"6491c8",runId:"cmd-ui-check",hypothesisId:"H4",location:"src/wrapper/runSkillCommand.ts:296",message:"runner resolution",data:{skillName,runnerFound:Boolean(runner),hasLlmClient:Boolean(options.llmClient)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!runner) {
    return {
      ok: false,
      mode: "error",
      content: `No runtime handler for skill: ${skillName}. This skill is registered but its TypeScript runtime has not been implemented yet.`,
    };
  }

  if (!options.llmClient) {
    return {
      ok: false,
      mode: "error",
      content:
        "LLM client is required but was not provided. Call initSkillWrapper({ llmClient }) first.",
    };
  }

  const mergedInput = mapFlagsToInput(skillName, flags, baseInput);

  let result: {
    ok: boolean;
    data?: unknown;
    error?: unknown;
    diagnostics?: unknown;
  };
  try {
    result = await runner(mergedInput, options.llmClient);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      mode: "error",
      content: `Skill execution failed: ${message}`,
    };
  }

  let artifactPath: string | undefined;
  try {
    artifactPath = persistArtifact(config, skillName, result);
  } catch {
    // Non-fatal — don't block output if artifact write fails
  }

  if (!result.ok) {
    const msg = extractErrorMessage(result as Record<string, unknown>);
    return {
      ok: false,
      mode: "error",
      content: `Skill returned an error: ${msg}${artifactPath ? `\nArtifact: ${artifactPath}` : ""}`,
      artifactPath,
    };
  }

  if (useRaw) {
    return {
      ok: true,
      mode: "raw",
      content: JSON.stringify(result.data, null, 2),
      artifactPath,
    };
  }

  const insight = formatInsight(skillName, result.data);
  // #region agent log
  fetch("http://127.0.0.1:7848/ingest/394e6945-2750-434f-bb8d-31c4f129abe1",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"6491c8"},body:JSON.stringify({sessionId:"6491c8",runId:"cmd-ui-check",hypothesisId:"H5",location:"src/wrapper/runSkillCommand.ts:365",message:"runSkillCommand success",data:{skillName,mode:useRaw ? "raw" : "insight",artifactPath:artifactPath ?? null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return {
    ok: true,
    mode: "insight",
    content: insight,
    artifactPath,
  };
}
