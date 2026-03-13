import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateRedteamInput,
  validateRedteamOutput,
} from "../src/validators/redteam.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = resolve(__dirname, "../skills/redteam/examples");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(EXAMPLES, filename), "utf-8"));
}

describe("validateRedteamInput", () => {
  it("passes for transcript-only mode fixture", () => {
    const input = loadFixture("sample-input.json");
    const result = validateRedteamInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes for transcript + focus mode fixture", () => {
    const input = loadFixture("sample-input-with-focus.json");
    const result = validateRedteamInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when transcript is missing", () => {
    const result = validateRedteamInput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("fails when transcript is too short", () => {
    const result = validateRedteamInput({ transcript: "too short" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "minLength")).toBe(true);
  });

  it("fails for invalid risk_tolerance enum value", () => {
    const result = validateRedteamInput({
      transcript: "A".repeat(50),
      risk_tolerance: "extreme",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "enum")).toBe(true);
  });

  it("fails when focus_questions item is too short", () => {
    const result = validateRedteamInput({
      transcript: "A".repeat(50),
      focus_questions: ["ok", "no"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "minLength")).toBe(true);
  });

  it("fails when extra properties are present", () => {
    const result = validateRedteamInput({
      transcript: "A".repeat(50),
      not_a_real_field: "should fail",
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.keyword === "additionalProperties"),
    ).toBe(true);
  });
});

describe("validateRedteamOutput", () => {
  it("passes for sample output fixture", () => {
    const output = loadFixture("sample-output.json");
    const result = validateRedteamOutput(output);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when required field summary is missing", () => {
    const output = loadFixture("sample-output.json") as Record<string, unknown>;
    const { summary: _, ...withoutSummary } = output;
    const result = validateRedteamOutput(withoutSummary);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("fails when failure_mode severity exceeds maximum", () => {
    const output = loadFixture("sample-output.json") as Record<string, unknown>;
    const modified = {
      ...output,
      failure_modes: [
        {
          id: "FM-001",
          title: "Test",
          severity: 6,
          likelihood: 3,
          why_it_fails: "test",
          leading_indicators: ["test"],
          mitigation: "test",
        },
      ],
    };
    const result = validateRedteamOutput(modified);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "maximum")).toBe(true);
  });

  it("fails when decision_recommendation has invalid enum", () => {
    const output = loadFixture("sample-output.json") as Record<string, unknown>;
    const modified = {
      ...output,
      decision_recommendation: {
        recommendation: "maybe",
        rationale: "test",
        required_next_checks: [],
      },
    };
    const result = validateRedteamOutput(modified);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "enum")).toBe(true);
  });
});
