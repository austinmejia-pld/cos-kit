/**
 * Assertion library for commitment-extractor eval harness.
 *
 * Each function checks one quality dimension of the extractor output and
 * returns a self-describing result: { pass, label, detail }.
 *
 * Run via: npm run eval:commitment-extractor
 */

import { validateCommitmentExtractorOutput } from "../../src/validators/commitmentExtractor.js";
import type { CommitmentExtractorOutput } from "../../src/skills/commitment-extractor/types.js";

// ── Result type ─────────────────────────────────────────────────────

export interface AssertionResult {
  pass: boolean;
  label: string;
  detail: string;
}

// ── Assertion config (from .case.json) ──────────────────────────────

export interface AssertionConfig {
  min_commitments: number;
  min_owners: number;
  completeness_threshold: number;
  max_duplicate_ratio: number;
  expected_mode: string;
}

// ── Individual assertions ───────────────────────────────────────────

export function assertMinCommitments(
  output: CommitmentExtractorOutput,
  min: number,
): AssertionResult {
  const actual = output.commitments.length;
  return {
    pass: actual >= min,
    label: `>=${min} commitments extracted`,
    detail: `Found ${actual} commitment(s), required >=${min}`,
  };
}

export function assertEveryCommitmentHasEvidence(
  output: CommitmentExtractorOutput,
): AssertionResult {
  const missing = output.commitments.filter(
    (c) =>
      !Array.isArray(c.source_evidence) ||
      c.source_evidence.length === 0 ||
      c.source_evidence.every((e) => !e.quote || e.quote.trim() === ""),
  );
  return {
    pass: missing.length === 0,
    label: "Every commitment has source evidence",
    detail:
      missing.length === 0
        ? "All commitments have at least 1 non-empty evidence quote"
        : `${missing.length} commitment(s) missing evidence: ${missing.map((c) => c.id).join(", ")}`,
  };
}

export function assertFieldCompleteness(
  output: CommitmentExtractorOutput,
  threshold: number,
): AssertionResult {
  const fields = ["owner", "due_date_raw", "proof_artifact_expected"] as const;
  let totalFields = 0;
  let completeFields = 0;

  for (const c of output.commitments) {
    for (const f of fields) {
      totalFields++;
      const val = c[f];
      if (typeof val === "string" && val.trim() !== "" && val !== "UNKNOWN") {
        completeFields++;
      }
    }
  }

  const ratio = totalFields === 0 ? 0 : completeFields / totalFields;
  return {
    pass: ratio >= threshold,
    label: `Field completeness >=${(threshold * 100).toFixed(0)}%`,
    detail: `${completeFields}/${totalFields} fields complete (${(ratio * 100).toFixed(1)}%), threshold ${(threshold * 100).toFixed(0)}%`,
  };
}

export function assertMissingFieldsFlagged(
  output: CommitmentExtractorOutput,
): AssertionResult {
  const unflagged: string[] = [];

  for (const c of output.commitments) {
    const gaps: string[] = [];
    if (!c.owner || c.owner === "UNKNOWN") gaps.push("owner");
    if (!c.due_date_raw) gaps.push("due_date");
    if (!c.proof_artifact_expected) gaps.push("artifact");

    if (gaps.length > 0) {
      const flagged = output.missing_fields.some(
        (mf) => mf.commitment_id === c.id,
      );
      if (!flagged) unflagged.push(c.id);
    }
  }

  return {
    pass: unflagged.length === 0,
    label: "Incomplete commitments have missing_fields entries",
    detail:
      unflagged.length === 0
        ? "All incomplete commitments are flagged in missing_fields"
        : `${unflagged.length} commitment(s) with gaps not flagged: ${unflagged.join(", ")}`,
  };
}

export function assertSchemaValid(
  output: CommitmentExtractorOutput,
): AssertionResult {
  const result = validateCommitmentExtractorOutput(output);
  return {
    pass: result.valid,
    label: "Output passes JSON Schema validation",
    detail: result.valid
      ? "Schema validation PASS"
      : `Schema validation FAIL: ${result.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
  };
}

export function assertDuplicatesBelowThreshold(
  output: CommitmentExtractorOutput,
  maxRatio: number,
): AssertionResult {
  const commitments = output.commitments;
  const n = commitments.length;
  if (n <= 1) {
    return {
      pass: true,
      label: `Duplicate ratio <${(maxRatio * 100).toFixed(0)}%`,
      detail: "0 or 1 commitments — no duplicates possible",
    };
  }

  let duplicatePairs = 0;
  const totalPairs = (n * (n - 1)) / 2;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (
        commitments[i].owner.toLowerCase() ===
          commitments[j].owner.toLowerCase() &&
        tokenOverlap(
          commitments[i].commitment_text,
          commitments[j].commitment_text,
        ) > 0.8
      ) {
        duplicatePairs++;
      }
    }
  }

  const ratio = duplicatePairs / totalPairs;
  return {
    pass: ratio <= maxRatio,
    label: `Duplicate ratio <${(maxRatio * 100).toFixed(0)}%`,
    detail: `${duplicatePairs} near-duplicate pair(s) out of ${totalPairs} total (${(ratio * 100).toFixed(1)}%), max ${(maxRatio * 100).toFixed(0)}%`,
  };
}

export function assertModeUsed(
  output: CommitmentExtractorOutput,
  expected: string,
): AssertionResult {
  const actual = output.metadata.mode_used;
  return {
    pass: actual === expected,
    label: `mode_used is "${expected}"`,
    detail: actual === expected ? `mode_used = "${actual}"` : `Expected "${expected}", got "${actual}"`,
  };
}

// ── Aggregate runner ────────────────────────────────────────────────

export function runAllAssertions(
  output: CommitmentExtractorOutput,
  config: AssertionConfig,
): AssertionResult[] {
  return [
    assertMinCommitments(output, config.min_commitments),
    assertEveryCommitmentHasEvidence(output),
    assertFieldCompleteness(output, config.completeness_threshold),
    assertMissingFieldsFlagged(output),
    assertSchemaValid(output),
    assertDuplicatesBelowThreshold(output, config.max_duplicate_ratio),
    assertModeUsed(output, config.expected_mode),
  ];
}

export function computeQualityScore(results: AssertionResult[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter((r) => r.pass).length;
  return Math.round((passed / results.length) * 100);
}

// ── Token overlap (same logic as mapper.ts) ─────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 0),
  );
}

function tokenOverlap(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let shared = 0;
  for (const tok of setA) {
    if (setB.has(tok)) shared++;
  }
  return shared / Math.max(setA.size, setB.size);
}
