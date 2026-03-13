/**
 * Assertion library for decision-quality-audit eval harness.
 *
 * Each function checks one quality dimension of the audit output and
 * returns a self-describing result: { pass, label, detail }.
 */

import { validateDecisionQualityAuditOutput } from "../../src/validators/decisionQualityAudit.js";
import type { DecisionQualityAuditOutput } from "../../src/skills/decision-quality-audit/types.js";

// ── Result type ─────────────────────────────────────────────────────

export interface AssertionResult {
  pass: boolean;
  label: string;
  detail: string;
}

// ── Assertion config (from .case.json) ──────────────────────────────

export interface AssertionConfig {
  min_gaps: number;
  min_assumptions: number;
  min_citations: number;
  score_range: [number, number];
  expected_mode: string;
}

// ── Individual assertions ───────────────────────────────────────────

export function assertSchemaValid(
  output: DecisionQualityAuditOutput,
): AssertionResult {
  const result = validateDecisionQualityAuditOutput(output);
  return {
    pass: result.valid,
    label: "Output passes JSON Schema validation",
    detail: result.valid
      ? "Schema validation PASS"
      : `Schema validation FAIL: ${result.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
  };
}

export function assertDecisionStatusPopulated(
  output: DecisionQualityAuditOutput,
): AssertionResult {
  const valid = ["clear_decision", "tentative_decision", "no_decision"];
  const actual = output.decision_status;
  return {
    pass: valid.includes(actual),
    label: "decision_status is a valid enum value",
    detail: valid.includes(actual)
      ? `decision_status = "${actual}"`
      : `Invalid decision_status: "${actual}", expected one of ${valid.join(", ")}`,
  };
}

export function assertScoreInRange(
  output: DecisionQualityAuditOutput,
  range: [number, number],
): AssertionResult {
  const score = output.decision_quality_score;
  const inRange = score >= range[0] && score <= range[1];
  return {
    pass: inRange,
    label: `decision_quality_score in [${range[0]}, ${range[1]}]`,
    detail: inRange
      ? `Score = ${score}`
      : `Score = ${score}, expected [${range[0]}, ${range[1]}]`,
  };
}

export function assertScoreBreakdownComplete(
  output: DecisionQualityAuditOutput,
): AssertionResult {
  const dimensions = [
    "clarity_of_decision",
    "evidence_quality",
    "alternatives_considered",
    "risk_assessment_quality",
    "ownership_and_accountability",
    "reversibility_and_checkpoints",
  ] as const;

  const problems: string[] = [];
  for (const dim of dimensions) {
    const val = output.score_breakdown[dim];
    if (val === undefined || val === null) {
      problems.push(`${dim}: missing`);
    } else if (typeof val !== "number" || val < 0 || val > 100) {
      problems.push(`${dim}: ${val} (out of 0-100)`);
    }
  }

  return {
    pass: problems.length === 0,
    label: "score_breakdown has all 6 dimensions in 0-100",
    detail:
      problems.length === 0
        ? `All 6 dimensions present and valid`
        : `Problems: ${problems.join("; ")}`,
  };
}

export function assertMinGaps(
  output: DecisionQualityAuditOutput,
  min: number,
): AssertionResult {
  const count = output.gaps.length;
  if (count < min) {
    return {
      pass: false,
      label: `>=${min} gaps with evidence and fixes`,
      detail: `Found ${count} gap(s), required >=${min}`,
    };
  }

  const incomplete = output.gaps.filter(
    (g) =>
      !g.gap ||
      !g.fix ||
      !Array.isArray(g.evidence) ||
      g.evidence.length === 0,
  );

  return {
    pass: incomplete.length === 0,
    label: `>=${min} gaps with evidence and fixes`,
    detail:
      incomplete.length === 0
        ? `${count} gap(s) — all have evidence and fix`
        : `${count} gap(s) but ${incomplete.length} missing evidence or fix`,
  };
}

export function assertMinAssumptions(
  output: DecisionQualityAuditOutput,
  min: number,
): AssertionResult {
  const count = output.assumptions.length;
  return {
    pass: count >= min,
    label: `>=${min} assumptions surfaced`,
    detail: `Found ${count} assumption(s), required >=${min}`,
  };
}

export function assertAccountabilityFields(
  output: DecisionQualityAuditOutput,
): AssertionResult {
  const entries = output.accountability_snapshot;
  if (entries.length === 0) {
    return {
      pass: true,
      label: "accountability_snapshot entries have owner + commitment",
      detail: "No entries to validate (empty array is allowed)",
    };
  }

  const problems: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const missing: string[] = [];
    if (!e.owner || e.owner.trim() === "" || e.owner === "Unassigned")
      missing.push("owner");
    if (!e.commitment || e.commitment.trim() === "")
      missing.push("commitment");
    if (missing.length > 0)
      problems.push(`entry[${i}]: missing ${missing.join(", ")}`);
  }

  return {
    pass: problems.length === 0,
    label: "accountability_snapshot entries have owner + commitment",
    detail:
      problems.length === 0
        ? `All ${entries.length} entries have owner and commitment`
        : problems.join("; "),
  };
}

const GENERIC_PHRASES = [
  "communicate better",
  "align the team",
  "improve communication",
  "be more aligned",
  "discuss more",
  "think harder",
  "be more careful",
];

export function assertUpgradeSpecific(
  output: DecisionQualityAuditOutput,
): AssertionResult {
  const text = output.single_most_important_upgrade.upgrade.toLowerCase();
  const matched = GENERIC_PHRASES.find((phrase) => text.includes(phrase));

  return {
    pass: !matched,
    label: "single_most_important_upgrade is specific (non-generic)",
    detail: matched
      ? `Upgrade contains generic phrase: "${matched}"`
      : `Upgrade text is specific and operational`,
  };
}

export function assertMinCitations(
  output: DecisionQualityAuditOutput,
  min: number,
): AssertionResult {
  const count = output.citations.length;
  return {
    pass: count >= min,
    label: `>=${min} citations`,
    detail: `Found ${count} citation(s), required >=${min}`,
  };
}

export function assertModeUsed(
  output: DecisionQualityAuditOutput,
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
  output: DecisionQualityAuditOutput,
  config: AssertionConfig,
): AssertionResult[] {
  return [
    assertSchemaValid(output),
    assertDecisionStatusPopulated(output),
    assertScoreInRange(output, config.score_range),
    assertScoreBreakdownComplete(output),
    assertMinGaps(output, config.min_gaps),
    assertMinAssumptions(output, config.min_assumptions),
    assertAccountabilityFields(output),
    assertUpgradeSpecific(output),
    assertMinCitations(output, config.min_citations),
    assertModeUsed(output, config.expected_mode),
  ];
}

export function computeQualityScore(results: AssertionResult[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter((r) => r.pass).length;
  return Math.round((passed / results.length) * 100);
}
