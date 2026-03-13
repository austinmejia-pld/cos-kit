/**
 * Assertion library for execution-friction-xray eval harness.
 *
 * Each function checks one quality dimension of the xray output and
 * returns a self-describing result: { pass, label, detail }.
 *
 * Run via: npm run eval:execution-friction-xray
 */

import { validateExecutionFrictionXrayOutput } from "../../src/validators/executionFrictionXray.js";
import type { ExecutionFrictionXrayOutput } from "../../src/skills/execution-friction-xray/types.js";

// ── Result type ─────────────────────────────────────────────────────

export interface AssertionResult {
  pass: boolean;
  label: string;
  detail: string;
}

// ── Assertion config (from .case.json) ──────────────────────────────

export interface AssertionConfig {
  min_hotspots: number;
  min_critical_path_risks: number;
  min_kill_plan_actions: number;
  min_citations: number;
  expected_mode: string;
}

// ── Individual assertions ───────────────────────────────────────────

export function assertSchemaValid(
  output: ExecutionFrictionXrayOutput,
): AssertionResult {
  const result = validateExecutionFrictionXrayOutput(output);
  return {
    pass: result.valid,
    label: "Output passes JSON Schema validation",
    detail: result.valid
      ? "Schema validation PASS"
      : `Schema validation FAIL: ${result.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
  };
}

export function assertMinHotspots(
  output: ExecutionFrictionXrayOutput,
  min: number,
): AssertionResult {
  const actual = output.friction_hotspots.length;
  return {
    pass: actual >= min,
    label: `>=${min} friction hotspots`,
    detail: `Found ${actual} hotspot(s), required >=${min}`,
  };
}

export function assertEveryHotspotHasEvidence(
  output: ExecutionFrictionXrayOutput,
): AssertionResult {
  const missing = output.friction_hotspots.filter(
    (h) =>
      !Array.isArray(h.evidence) ||
      h.evidence.length === 0 ||
      h.evidence.every((e) => !e.quote || e.quote.trim() === ""),
  );
  return {
    pass: missing.length === 0,
    label: "Every hotspot has evidence with non-empty quotes",
    detail:
      missing.length === 0
        ? "All hotspots have at least 1 non-empty evidence quote"
        : `${missing.length} hotspot(s) missing evidence: ${missing.map((h) => h.id).join(", ")}`,
  };
}

export function assertEveryHotspotHasFix(
  output: ExecutionFrictionXrayOutput,
): AssertionResult {
  const incomplete = output.friction_hotspots.filter(
    (h) =>
      !h.recommended_fix ||
      h.recommended_fix.trim() === "" ||
      !h.owner_recommendation ||
      h.owner_recommendation.trim() === "",
  );
  return {
    pass: incomplete.length === 0,
    label: "Every hotspot has recommended_fix and owner_recommendation",
    detail:
      incomplete.length === 0
        ? "All hotspots have non-empty recommended_fix and owner_recommendation"
        : `${incomplete.length} hotspot(s) missing fix/owner: ${incomplete.map((h) => h.id).join(", ")}`,
  };
}

export function assertMinCriticalPathRisks(
  output: ExecutionFrictionXrayOutput,
  min: number,
): AssertionResult {
  const actual = output.critical_path_risks.length;
  return {
    pass: actual >= min,
    label: `>=${min} critical path risks`,
    detail: `Found ${actual} critical path risk(s), required >=${min}`,
  };
}

export function assertMinKillPlanActions(
  output: ExecutionFrictionXrayOutput,
  min: number,
): AssertionResult {
  const actual = output.next_7_day_friction_kill_plan.length;
  if (actual < min) {
    return {
      pass: false,
      label: `>=${min} kill plan actions with owner/due/proof_artifact`,
      detail: `Found ${actual} action(s), required >=${min}`,
    };
  }

  const incomplete = output.next_7_day_friction_kill_plan.filter(
    (a) =>
      !a.owner ||
      a.owner.trim() === "" ||
      !a.due ||
      a.due.trim() === "" ||
      !a.proof_artifact ||
      a.proof_artifact.trim() === "",
  );

  return {
    pass: incomplete.length === 0,
    label: `>=${min} kill plan actions with owner/due/proof_artifact`,
    detail:
      incomplete.length === 0
        ? `All ${actual} kill plan actions have owner, due, and proof_artifact`
        : `${incomplete.length} of ${actual} action(s) missing owner/due/proof_artifact`,
  };
}

export function assertMinCitations(
  output: ExecutionFrictionXrayOutput,
  min: number,
): AssertionResult {
  const actual = output.citations.length;
  return {
    pass: actual >= min,
    label: `>=${min} citations`,
    detail: `Found ${actual} citation(s), required >=${min}`,
  };
}

export function assertHighestLeverageMovePresent(
  output: ExecutionFrictionXrayOutput,
): AssertionResult {
  const move = output.single_highest_leverage_move;
  const hasMove = !!move && !!move.move && move.move.trim().length > 10;

  const genericPhrases = [
    "improve things",
    "do better",
    "fix issues",
    "address problems",
    "take action",
  ];
  const isGeneric =
    hasMove &&
    genericPhrases.some((p) => move.move.toLowerCase().includes(p));

  return {
    pass: hasMove && !isGeneric,
    label: "Highest leverage move is present and specific",
    detail: !hasMove
      ? "single_highest_leverage_move.move is missing or too short (<10 chars)"
      : isGeneric
        ? `Move appears generic: "${move.move.slice(0, 80)}"`
        : `Move present: "${move.move.slice(0, 80)}${move.move.length > 80 ? "…" : ""}"`,
  };
}

export function assertModeUsed(
  output: ExecutionFrictionXrayOutput,
  expected: string,
): AssertionResult {
  const actual = output.metadata.mode_used;
  return {
    pass: actual === expected,
    label: `mode_used is "${expected}"`,
    detail:
      actual === expected
        ? `mode_used = "${actual}"`
        : `Expected "${expected}", got "${actual}"`,
  };
}

// ── Aggregate runner ────────────────────────────────────────────────

export function runAllAssertions(
  output: ExecutionFrictionXrayOutput,
  config: AssertionConfig,
): AssertionResult[] {
  return [
    assertSchemaValid(output),
    assertMinHotspots(output, config.min_hotspots),
    assertEveryHotspotHasEvidence(output),
    assertEveryHotspotHasFix(output),
    assertMinCriticalPathRisks(output, config.min_critical_path_risks),
    assertMinKillPlanActions(output, config.min_kill_plan_actions),
    assertMinCitations(output, config.min_citations),
    assertHighestLeverageMovePresent(output),
    assertModeUsed(output, config.expected_mode),
  ];
}

export function computeQualityScore(results: AssertionResult[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter((r) => r.pass).length;
  return Math.round((passed / results.length) * 100);
}
