import {
  validateStakeholderAnalysisInput,
  validateStakeholderAnalysisOutput,
} from "../../validators/stakeholderAnalysis.js";
import { normalizeOutput, assessConfidence } from "./mapper.js";
import type {
  StakeholderAnalysisInput,
  RunResult,
  Diagnostics,
} from "./types.js";

/**
 * Run the stakeholder-analysis skill pipeline.
 *
 * Accepts a raw input payload and a pre-computed LLM response JSON string.
 * Validates input, parses/normalizes the LLM output, runs a confidence
 * heuristic, validates the final output against the schema, and returns
 * a structured result.
 *
 * TODO: Replace `llmResponseJson` parameter with an actual LLM call once
 * a model invocation layer is added to the project. The system and user
 * prompt templates are available at:
 *   - src/skills/stakeholder-analysis/prompt.system.md
 *   - src/skills/stakeholder-analysis/prompt.user.template.md
 */
export async function runStakeholderAnalysis(
  input: unknown,
  llmResponseJson: string,
): Promise<RunResult> {
  // Step 1: Validate input
  const inputResult = validateStakeholderAnalysisInput(input);
  if (!inputResult.valid) {
    return {
      ok: false,
      error: {
        stage: "input_validation",
        message: "Input does not conform to stakeholder-analysis input schema",
        details: inputResult.errors,
      },
    };
  }

  const typedInput = input as StakeholderAnalysisInput;

  // Step 2: Parse LLM response
  // TODO: Replace with actual LLM call. For now, accepts pre-computed response.
  let parsed: unknown;
  try {
    parsed = JSON.parse(llmResponseJson);
  } catch (err) {
    return {
      ok: false,
      error: {
        stage: "json_parse",
        message: "Failed to parse LLM response as JSON",
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Step 3: Normalize the raw output
  let normalized;
  try {
    normalized = normalizeOutput(parsed, typedInput);
  } catch (err) {
    return {
      ok: false,
      error: {
        stage: "normalization",
        message: "Failed to normalize LLM output",
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // Step 4: Confidence heuristic
  const confidence = assessConfidence(normalized);
  const warnings: string[] = [];

  if (!confidence.high) {
    warnings.push(
      `Low confidence analysis: ${confidence.reasons.filter((r) => r.includes("Only") || r.includes("No")).join("; ")}`,
    );
  }

  const diagnostics: Diagnostics = {
    mode_used: normalized.metadata.mode_used,
    warnings,
  };

  // Step 5: Validate output against schema
  const outputResult = validateStakeholderAnalysisOutput(normalized);
  if (!outputResult.valid) {
    return {
      ok: false,
      error: {
        stage: "output_validation",
        message: "Normalized output does not conform to stakeholder-analysis output schema",
        details: outputResult.errors,
      },
      diagnostics,
    };
  }

  return {
    ok: true,
    data: normalized,
    diagnostics,
  };
}
