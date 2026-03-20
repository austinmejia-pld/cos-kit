/**
 * Eval runner for effective-communication.
 *
 * Loads eval cases from a single JSON file, runs each through the skill with
 * a mock LLM, checks quality assertions, and produces a scored pass/fail
 * summary. Also runs negative-scenario tests for error handling.
 *
 * Run via: npm run eval:effective-communication
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runEffectiveCommunication } from "../src/skills/effective-communication/index.js";
import { validateEffectiveCommunicationOutput } from "../src/validators/effectiveCommunication.js";
import type { LLMClient } from "../src/skills/effective-communication/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types ───────────────────────────────────────────────────────────

export interface AssertionConfig {
  min_citations: number;
  min_priority_improvements: number;
  expected_status: string;
  score_range: [number, number];
  expected_mode: string;
  require_rewrite_fields: boolean;
  reject_generic_advice: boolean;
}

export interface EvalCase {
  id: string;
  description: string;
  input: unknown;
  mock_llm_response: string;
  assertions: AssertionConfig;
}

export interface AssertionResult {
  pass: boolean;
  label: string;
  detail: string;
}

export interface EvalReport {
  caseId: string;
  pass: boolean;
  qualityScore: number | null;
  assertions: AssertionResult[];
  warnings: string[];
  error?: string;
}

export interface NegativeTestResult {
  caseId: string;
  pass: boolean;
  detail: string;
}

// ── Mock LLM client ─────────────────────────────────────────────────

function mockClient(response: string): LLMClient {
  return { chat: async () => response };
}

// ── Individual assertions ───────────────────────────────────────────

function assertSchemaValid(output: Record<string, unknown>): AssertionResult {
  const result = validateEffectiveCommunicationOutput(output);
  return {
    pass: result.valid,
    label: "Output passes JSON Schema validation",
    detail: result.valid
      ? "Schema validation PASS"
      : `Schema validation FAIL: ${result.errors.map((e) => `${e.path}: ${e.message}`).join("; ")}`,
  };
}

function assertMinCitations(
  output: Record<string, unknown>,
  min: number,
): AssertionResult {
  const citations = output.citations as unknown[];
  const actual = Array.isArray(citations) ? citations.length : 0;
  return {
    pass: actual >= min,
    label: `>=${min} citations`,
    detail: `Found ${actual} citation(s), required >=${min}`,
  };
}

function assertMinPriorityImprovements(
  output: Record<string, unknown>,
  min: number,
): AssertionResult {
  const improvements = output.priority_improvements as unknown[];
  const actual = Array.isArray(improvements) ? improvements.length : 0;
  return {
    pass: actual >= min,
    label: `>=${min} priority improvements`,
    detail: `Found ${actual} improvement(s), required >=${min}`,
  };
}

function assertRewriteFieldsPresent(
  output: Record<string, unknown>,
): AssertionResult {
  const improvements = (output.priority_improvements ?? []) as Array<{
    theme?: string;
    rewrite?: { before?: string; after?: string; why_better?: string };
  }>;

  const missing: string[] = [];

  for (let i = 0; i < improvements.length; i++) {
    const imp = improvements[i];
    const rw = imp.rewrite;
    if (!rw) {
      missing.push(`improvement[${i}] missing rewrite object`);
      continue;
    }
    if (!rw.before || rw.before.trim() === "") {
      missing.push(`improvement[${i}] missing rewrite.before`);
    }
    if (!rw.after || rw.after.trim() === "") {
      missing.push(`improvement[${i}] missing rewrite.after`);
    }
    if (!rw.why_better || rw.why_better.trim() === "") {
      missing.push(`improvement[${i}] missing rewrite.why_better`);
    }
  }

  return {
    pass: missing.length === 0,
    label: "Every improvement has rewrite.before, .after, .why_better",
    detail:
      missing.length === 0
        ? "All improvements have complete rewrite fields"
        : `Missing fields: ${missing.join("; ")}`,
  };
}

function assertOneThingConcrete(
  output: Record<string, unknown>,
): AssertionResult {
  const oneThingRaw = output.one_thing_to_change_next_meeting as
    | { change?: string }
    | undefined;
  const change = oneThingRaw?.change ?? "";
  const isPresent = change.trim().length > 20;

  return {
    pass: isPresent,
    label: "one_thing_to_change is present and concrete (>20 chars)",
    detail: isPresent
      ? `one_thing_to_change.change has ${change.length} characters`
      : `one_thing_to_change.change is too short or missing (${change.length} chars)`,
  };
}

const GENERIC_PHRASES = [
  "be clearer",
  "communicate better",
  "be more concise",
  "improve your communication",
  "try to be more",
  "work on being",
  "be more direct",
  "be more structured",
];

function assertRejectGenericAdvice(
  output: Record<string, unknown>,
): AssertionResult {
  const improvements = (output.priority_improvements ?? []) as Array<{
    theme?: string;
    diagnosis?: string;
    evidence?: Array<{ quote?: string }>;
    rewrite?: { before?: string; after?: string };
  }>;

  const violations: string[] = [];

  for (let i = 0; i < improvements.length; i++) {
    const imp = improvements[i];
    const textToCheck = `${imp.theme ?? ""} ${imp.diagnosis ?? ""}`.toLowerCase();

    for (const phrase of GENERIC_PHRASES) {
      if (textToCheck.includes(phrase)) {
        // Check if it's backed by evidence + rewrite
        const hasEvidence =
          Array.isArray(imp.evidence) &&
          imp.evidence.length > 0 &&
          imp.evidence.some((e) => e.quote && e.quote.trim().length > 0);
        const hasRewrite =
          imp.rewrite &&
          imp.rewrite.before &&
          imp.rewrite.before.trim().length > 0 &&
          imp.rewrite.after &&
          imp.rewrite.after.trim().length > 0;

        if (!hasEvidence || !hasRewrite) {
          violations.push(
            `improvement[${i}] uses generic phrase "${phrase}" without sufficient evidence + rewrite`,
          );
        }
      }
    }
  }

  return {
    pass: violations.length === 0,
    label: "No generic advice without evidence + rewrite",
    detail:
      violations.length === 0
        ? "No ungrounded generic advice detected"
        : `Generic advice violations: ${violations.join("; ")}`,
  };
}

function assertScoreInRange(
  output: Record<string, unknown>,
  range: [number, number],
): AssertionResult {
  const score = output.overall_effectiveness_score as number;
  const pass = score >= range[0] && score <= range[1];
  return {
    pass,
    label: `Score in range [${range[0]}, ${range[1]}]`,
    detail: `overall_effectiveness_score = ${score}, expected [${range[0]}, ${range[1]}]`,
  };
}

function assertExpectedStatus(
  output: Record<string, unknown>,
  expected: string,
): AssertionResult {
  const actual = output.communication_status as string;
  return {
    pass: actual === expected,
    label: `communication_status is "${expected}"`,
    detail:
      actual === expected
        ? `communication_status = "${actual}"`
        : `Expected "${expected}", got "${actual}"`,
  };
}

function assertExpectedMode(
  output: Record<string, unknown>,
  expected: string,
): AssertionResult {
  const metadata = output.metadata as { mode_used?: string } | undefined;
  const actual = metadata?.mode_used ?? "unknown";
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

function runAllAssertions(
  output: Record<string, unknown>,
  config: AssertionConfig,
): AssertionResult[] {
  return [
    assertSchemaValid(output),
    assertMinCitations(output, config.min_citations),
    assertMinPriorityImprovements(output, config.min_priority_improvements),
    assertRewriteFieldsPresent(output),
    assertOneThingConcrete(output),
    assertRejectGenericAdvice(output),
    assertScoreInRange(output, config.score_range),
    assertExpectedStatus(output, config.expected_status),
    assertExpectedMode(output, config.expected_mode),
  ];
}

function computeQualityScore(results: AssertionResult[]): number {
  if (results.length === 0) return 0;
  const passed = results.filter((r) => r.pass).length;
  return Math.round((passed / results.length) * 100);
}

// ── Run a single positive eval case ─────────────────────────────────

export async function runEvalCase(caseDef: EvalCase): Promise<EvalReport> {
  const client = mockClient(caseDef.mock_llm_response);
  const result = await runEffectiveCommunication(caseDef.input, client);

  if (!result.ok) {
    return {
      caseId: caseDef.id,
      pass: false,
      qualityScore: null,
      assertions: [],
      warnings: [],
      error: result.error,
    };
  }

  const assertions = runAllAssertions(
    result.data as Record<string, unknown>,
    caseDef.assertions,
  );
  const score = computeQualityScore(assertions);
  const allPass = assertions.every((a) => a.pass);

  return {
    caseId: caseDef.id,
    pass: allPass,
    qualityScore: score,
    assertions,
    warnings: result.diagnostics.warnings,
  };
}

// ── Load eval cases from single JSON file ───────────────────────────

export function loadCases(): EvalCase[] {
  const casesPath = resolve(
    __dirname,
    "effective-communication.eval.cases.json",
  );
  const raw = readFileSync(casesPath, "utf-8");
  return JSON.parse(raw) as EvalCase[];
}

export async function runAllEvalCases(): Promise<EvalReport[]> {
  const cases = loadCases();
  const reports: EvalReport[] = [];
  for (const c of cases) {
    reports.push(await runEvalCase(c));
  }
  return reports;
}

// ── Negative scenario tests ─────────────────────────────────────────

export async function runNegativeTests(): Promise<NegativeTestResult[]> {
  const results: NegativeTestResult[] = [];

  // 1. Malformed JSON from LLM
  {
    const client = mockClient("Not valid JSON at all — just a plain string.");
    const input = { transcript: "A".repeat(200) };
    const result = await runEffectiveCommunication(input, client);
    const pass = !result.ok && result.error.includes("JSON");
    results.push({
      caseId: "negative:malformed-json",
      pass,
      detail: pass
        ? "Malformed LLM response correctly returned ok:false with JSON error"
        : `Expected ok:false with JSON error, got: ${JSON.stringify(result).slice(0, 200)}`,
    });
  }

  // 2. Empty transcript
  {
    const client = mockClient("{}");
    const result = await runEffectiveCommunication(
      { transcript: "" },
      client,
    );
    const pass =
      !result.ok &&
      !!result.validation_errors?.some((e) => e.keyword === "minLength");
    results.push({
      caseId: "negative:empty-transcript",
      pass,
      detail: pass
        ? "Empty transcript correctly rejected with minLength validation error"
        : `Expected minLength validation error, got: ${JSON.stringify(result).slice(0, 200)}`,
    });
  }

  // 3. Invalid enum
  {
    const client = mockClient("{}");
    const result = await runEffectiveCommunication(
      { transcript: "A".repeat(200), tone_target: "aggressive" },
      client,
    );
    const pass =
      !result.ok &&
      !!result.validation_errors?.some((e) => e.keyword === "enum");
    results.push({
      caseId: "negative:invalid-enum",
      pass,
      detail: pass
        ? "Invalid tone_target correctly rejected with enum validation error"
        : `Expected enum validation error, got: ${JSON.stringify(result).slice(0, 200)}`,
    });
  }

  return results;
}

// ── Summary printer ─────────────────────────────────────────────────

export function printSummary(
  reports: EvalReport[],
  negatives: NegativeTestResult[],
): void {
  const lines: string[] = [];
  const colCase = 28;
  const colStatus = 8;
  const colScore = 7;

  const hdr = (s: string, w: number) => s.padEnd(w);
  const sep = (w: number) => "─".repeat(w);

  lines.push(
    `┌${sep(colCase)}┬${sep(colStatus)}┬${sep(colScore)}┐`,
  );
  lines.push(
    `│${hdr(" Case", colCase)}│${hdr(" Status", colStatus)}│${hdr(" Score", colScore)}│`,
  );
  lines.push(
    `├${sep(colCase)}┼${sep(colStatus)}┼${sep(colScore)}┤`,
  );

  let totalPass = 0;
  let totalCount = 0;

  for (const r of reports) {
    totalCount++;
    if (r.pass) totalPass++;
    const status = r.pass ? "PASS" : "FAIL";
    const score =
      r.qualityScore !== null ? `${r.qualityScore}%` : "--";
    lines.push(
      `│${hdr(` ${r.caseId}`, colCase)}│${hdr(` ${status}`, colStatus)}│${hdr(` ${score}`, colScore)}│`,
    );
  }

  for (const n of negatives) {
    totalCount++;
    if (n.pass) totalPass++;
    const status = n.pass ? "PASS" : "FAIL";
    lines.push(
      `│${hdr(` ${n.caseId}`, colCase)}│${hdr(` ${status}`, colStatus)}│${hdr(` --`, colScore)}│`,
    );
  }

  lines.push(
    `└${sep(colCase)}┴${sep(colStatus)}┴${sep(colScore)}┘`,
  );

  const avgScore = reports
    .filter((r) => r.qualityScore !== null)
    .reduce((sum, r) => sum + r.qualityScore!, 0);
  const scoreCount = reports.filter(
    (r) => r.qualityScore !== null,
  ).length;
  const avgScoreStr =
    scoreCount > 0 ? `${Math.round(avgScore / scoreCount)}%` : "--";

  lines.push(
    `Overall: ${totalPass}/${totalCount} passed — Quality score: ${avgScoreStr}`,
  );

  console.log(lines.join("\n"));
}
