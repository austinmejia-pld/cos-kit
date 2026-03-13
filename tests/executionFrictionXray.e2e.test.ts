/**
 * End-to-end eval tests for execution-friction-xray.
 *
 * Loads eval cases from evals/execution-friction-xray/cases/, runs each through
 * the xray with a mock LLM, and asserts all quality checks pass.
 * Also runs negative-scenario tests for error handling.
 *
 * Run via: npm run eval:execution-friction-xray
 */

import { describe, it, expect } from "vitest";
import {
  loadCases,
  runEvalCase,
  runNegativeTests,
  printSummary,
} from "../evals/execution-friction-xray/run.js";

const cases = loadCases();

describe("execution-friction-xray eval — positive cases", () => {
  it.each(cases)("$id — passes all assertions", async (evalCase) => {
    const report = await runEvalCase(evalCase);

    if (report.error) {
      throw new Error(`Eval case "${evalCase.id}" failed: ${report.error}`);
    }

    const failed = report.assertions.filter((a) => !a.pass);
    if (failed.length > 0) {
      const details = failed.map((a) => `  [FAIL] ${a.label}: ${a.detail}`);
      throw new Error(
        `Eval case "${evalCase.id}" failed ${failed.length} assertion(s):\n${details.join("\n")}`,
      );
    }

    expect(report.pass).toBe(true);
    expect(report.qualityScore).toBe(100);
  });
});

describe("execution-friction-xray eval — negative tests", () => {
  it("negative: malformed JSON handled gracefully", async () => {
    const results = await runNegativeTests();
    const result = results.find((r) => r.caseId === "negative:malformed-json");
    expect(result).toBeDefined();
    expect(result!.pass).toBe(true);
  });

  it("negative: transcript too short rejected", async () => {
    const results = await runNegativeTests();
    const result = results.find(
      (r) => r.caseId === "negative:transcript-too-short",
    );
    expect(result).toBeDefined();
    expect(result!.pass).toBe(true);
  });

  it("negative: invalid enum rejected", async () => {
    const results = await runNegativeTests();
    const result = results.find((r) => r.caseId === "negative:invalid-enum");
    expect(result).toBeDefined();
    expect(result!.pass).toBe(true);
  });
});

describe("execution-friction-xray eval — summary", () => {
  it("prints pass/fail summary to stdout", async () => {
    const reports = await Promise.all(cases.map(runEvalCase));
    const negatives = await runNegativeTests();
    printSummary(reports, negatives);
  });
});
