import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateMeetingRiskAnalysisInput,
  validateMeetingRiskAnalysisOutput,
} from "../src/validators/meetingRiskAnalysis.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");
const EXAMPLES = resolve(__dirname, "../skills/meeting-risk-analysis/examples");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

function loadExample(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(EXAMPLES, filename), "utf-8"));
}

describe("meetingRiskAnalysis — input validation", () => {
  it("accepts the sample-input fixture", () => {
    const input = loadFixture("meeting-risk-analysis.input.json");
    const result = validateMeetingRiskAnalysisInput(input);
    expect(result.valid).toBe(true);
  });

  it("rejects empty object", () => {
    const result = validateMeetingRiskAnalysisInput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("rejects missing transcript", () => {
    const result = validateMeetingRiskAnalysisInput({
      meeting_id: "mtg_001",
      meeting_title: "Test",
      participants: ["Alice"],
      context: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects transcript below minLength", () => {
    const result = validateMeetingRiskAnalysisInput({
      meeting_id: "mtg_001",
      meeting_title: "Test",
      transcript: "too short",
      participants: ["Alice"],
      context: {},
    });
    expect(result.valid).toBe(false);
  });

  it("rejects empty participants array", () => {
    const result = validateMeetingRiskAnalysisInput({
      meeting_id: "mtg_001",
      meeting_title: "Test",
      transcript: "A".repeat(101),
      participants: [],
      context: {},
    });
    expect(result.valid).toBe(false);
  });
});

describe("meetingRiskAnalysis — output validation", () => {
  it("accepts the sample-output fixture", () => {
    const output = loadFixture("meeting-risk-analysis.output.example.json");
    const result = validateMeetingRiskAnalysisOutput(output);
    expect(result.valid).toBe(true);
  });

  it("rejects empty object", () => {
    const result = validateMeetingRiskAnalysisOutput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("rejects invalid overall_risk_level enum", () => {
    const output = loadFixture("meeting-risk-analysis.output.example.json") as Record<string, unknown>;
    const modified = { ...output, overall_risk_level: "extreme" };
    const result = validateMeetingRiskAnalysisOutput(modified);
    expect(result.valid).toBe(false);
  });

  it("rejects risks with invalid severity enum", () => {
    const output = loadFixture("meeting-risk-analysis.output.example.json") as Record<string, unknown>;
    const risks = (output.risks as Array<Record<string, unknown>>).map((r) => ({
      ...r,
      severity: "critical",
    }));
    const result = validateMeetingRiskAnalysisOutput({ ...output, risks });
    expect(result.valid).toBe(false);
  });

  it("rejects confidence outside 0-1 range", () => {
    const output = loadFixture("meeting-risk-analysis.output.example.json") as Record<string, unknown>;
    const result = validateMeetingRiskAnalysisOutput({ ...output, confidence: 1.5 });
    expect(result.valid).toBe(false);
  });

  it("rejects unresolved_tensions with fewer than 2 sides", () => {
    const output = loadFixture("meeting-risk-analysis.output.example.json") as Record<string, unknown>;
    const tensions = [
      {
        tension: "test",
        sides: ["only one"],
        evidence_quotes: ["quote"],
        why_it_matters: "reason",
      },
    ];
    const result = validateMeetingRiskAnalysisOutput({
      ...output,
      unresolved_tensions: tensions,
    });
    expect(result.valid).toBe(false);
  });
});
