/**
 * Eval runner for decision-quality-audit.
 *
 * Loads .case.json files, runs each through the audit with a mock LLM,
 * checks quality assertions, and produces a scored pass/fail summary.
 * Also runs negative-scenario tests for error handling.
 *
 * Run via: npm run eval:decision-quality-audit
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runDecisionQualityAudit } from "../../src/skills/decision-quality-audit/index.js";
import type { LLMClient } from "../../src/skills/decision-quality-audit/types.js";
import {
  runAllAssertions,
  computeQualityScore,
  type AssertionResult,
  type AssertionConfig,
} from "./assertions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types ───────────────────────────────────────────────────────────

export interface EvalCase {
  id: string;
  description: string;
  input: unknown;
  mock_llm_response: string;
  assertions: AssertionConfig;
}

export interface EvalReport {
  caseId: string;
  pass: boolean;
  qualityScore: number | null;
  assertions: AssertionResult[];
  warnings: string[];
  error?: string;
}

// ── Mock LLM client ─────────────────────────────────────────────────

function mockClient(response: string): LLMClient {
  return { chat: async () => response };
}

// ── Run a single positive eval case ─────────────────────────────────

export async function runEvalCase(caseDef: EvalCase): Promise<EvalReport> {
  const client = mockClient(caseDef.mock_llm_response);
  const result = await runDecisionQualityAudit(caseDef.input, client);

  if (!result.ok) {
    return {
      caseId: caseDef.id,
      pass: false,
      qualityScore: null,
      assertions: [],
      warnings: [],
      error: result.error.message,
    };
  }

  const assertions = runAllAssertions(result.data, caseDef.assertions);
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

// ── Load all .case.json files from a directory ──────────────────────

export function loadCases(casesDir?: string): EvalCase[] {
  const dir = casesDir ?? resolve(__dirname, "cases");
  const files = readdirSync(dir).filter((f) => f.endsWith(".case.json"));
  return files.map((f) => {
    const raw = readFileSync(resolve(dir, f), "utf-8");
    return JSON.parse(raw) as EvalCase;
  });
}

export async function runAllEvalCases(
  casesDir?: string,
): Promise<EvalReport[]> {
  const cases = loadCases(casesDir);
  const reports: EvalReport[] = [];
  for (const c of cases) {
    reports.push(await runEvalCase(c));
  }
  return reports;
}

// ── Negative scenario tests ─────────────────────────────────────────

export interface NegativeTestResult {
  caseId: string;
  pass: boolean;
  detail: string;
}

export async function runNegativeTests(): Promise<NegativeTestResult[]> {
  const results: NegativeTestResult[] = [];

  // 1. Malformed JSON from LLM
  {
    const client = mockClient("Not valid JSON at all — just a plain string.");
    const input = { transcript: "A".repeat(120) };
    const result = await runDecisionQualityAudit(input, client);
    const pass =
      !result.ok && result.error.stage === "json_parse";
    results.push({
      caseId: "negative:malformed-json",
      pass,
      detail: pass
        ? "Malformed LLM response correctly returned ok:false at json_parse stage"
        : `Expected ok:false at json_parse stage, got: ${JSON.stringify(result).slice(0, 200)}`,
    });
  }

  // 2. Short transcript (< 100 chars)
  {
    const client = mockClient("{}");
    const result = await runDecisionQualityAudit(
      { transcript: "Too short" },
      client,
    );
    const pass =
      !result.ok && result.error.stage === "input_validation";
    results.push({
      caseId: "negative:short-transcript",
      pass,
      detail: pass
        ? "Short transcript correctly rejected at input_validation stage"
        : `Expected ok:false at input_validation stage, got: ${JSON.stringify(result).slice(0, 200)}`,
    });
  }

  // 3. Invalid enum (risk_tolerance: "extreme")
  {
    const client = mockClient("{}");
    const result = await runDecisionQualityAudit(
      { transcript: "A".repeat(120), risk_tolerance: "extreme" },
      client,
    );
    const pass =
      !result.ok && result.error.stage === "input_validation";
    results.push({
      caseId: "negative:invalid-enum",
      pass,
      detail: pass
        ? "Invalid risk_tolerance correctly rejected at input_validation stage"
        : `Expected ok:false at input_validation stage, got: ${JSON.stringify(result).slice(0, 200)}`,
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
  const scoreCount = reports.filter((r) => r.qualityScore !== null).length;
  const avgScoreStr =
    scoreCount > 0 ? `${Math.round(avgScore / scoreCount)}%` : "--";

  lines.push(
    `Overall: ${totalPass}/${totalCount} passed — Quality score: ${avgScoreStr}`,
  );

  console.log(lines.join("\n"));
}
