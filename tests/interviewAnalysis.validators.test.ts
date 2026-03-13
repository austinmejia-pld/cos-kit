import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateInterviewAnalysisInput,
  validateInterviewAnalysisOutput,
} from "../src/validators/interviewAnalysis.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

describe("interviewAnalysis — input validation", () => {
  it("accepts the sample-input fixture", () => {
    const input = loadFixture("interview-analysis.input.json");
    const result = validateInterviewAnalysisInput(input);
    expect(result.valid).toBe(true);
  });

  it("rejects empty object", () => {
    const result = validateInterviewAnalysisInput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("rejects missing rubric", () => {
    const result = validateInterviewAnalysisInput({
      candidate_name: "Test",
      role: "Engineer",
      stage: "onsite",
      transcript: "A".repeat(51),
    });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid stage enum", () => {
    const result = validateInterviewAnalysisInput({
      candidate_name: "Test",
      role: "Engineer",
      stage: "informal_chat",
      transcript: "A".repeat(51),
      rubric: { dimensions: [{ name: "X", description: "Y", scale_min: 1, scale_max: 4 }] },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects empty dimensions array", () => {
    const result = validateInterviewAnalysisInput({
      candidate_name: "Test",
      role: "Engineer",
      stage: "onsite",
      transcript: "A".repeat(51),
      rubric: { dimensions: [] },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects transcript below minLength", () => {
    const result = validateInterviewAnalysisInput({
      candidate_name: "Test",
      role: "Engineer",
      stage: "onsite",
      transcript: "too short",
      rubric: { dimensions: [{ name: "X", description: "Y", scale_min: 1, scale_max: 4 }] },
    });
    expect(result.valid).toBe(false);
  });
});

describe("interviewAnalysis — output validation", () => {
  it("accepts the sample-output fixture", () => {
    const output = loadFixture("interview-analysis.output.example.json");
    const result = validateInterviewAnalysisOutput(output);
    expect(result.valid).toBe(true);
  });

  it("rejects empty object", () => {
    const result = validateInterviewAnalysisOutput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("rejects invalid recommendation enum", () => {
    const output = loadFixture("interview-analysis.output.example.json") as Record<string, unknown>;
    const result = validateInterviewAnalysisOutput({ ...output, recommendation: "maybe" });
    expect(result.valid).toBe(false);
  });

  it("rejects confidence outside 0-1 range", () => {
    const output = loadFixture("interview-analysis.output.example.json") as Record<string, unknown>;
    const result = validateInterviewAnalysisOutput({ ...output, confidence: 1.5 });
    expect(result.valid).toBe(false);
  });

  it("rejects score outside 1-4 range", () => {
    const output = loadFixture("interview-analysis.output.example.json") as Record<string, unknown>;
    const scores = [
      {
        dimension: "Test",
        score: 5,
        rationale: "test",
        evidence_quotes: ["quote"],
      },
    ];
    const result = validateInterviewAnalysisOutput({ ...output, dimension_scores: scores });
    expect(result.valid).toBe(false);
  });

  it("rejects dimension_scores with empty evidence_quotes", () => {
    const output = loadFixture("interview-analysis.output.example.json") as Record<string, unknown>;
    const scores = [
      {
        dimension: "Test",
        score: 2,
        rationale: "test",
        evidence_quotes: [],
      },
    ];
    const result = validateInterviewAnalysisOutput({ ...output, dimension_scores: scores });
    expect(result.valid).toBe(false);
  });
});
