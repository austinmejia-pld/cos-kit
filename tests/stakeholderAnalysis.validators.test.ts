import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateStakeholderAnalysisInput,
  validateStakeholderAnalysisOutput,
} from "../src/validators/stakeholderAnalysis.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

describe("validateStakeholderAnalysisInput", () => {
  it("passes for transcript-only mode fixture", () => {
    const input = loadFixture(
      "stakeholder-analysis.input.transcript-only.json",
    );
    const result = validateStakeholderAnalysisInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes for transcript + context mode fixture", () => {
    const input = loadFixture(
      "stakeholder-analysis.input.with-context.json",
    );
    const result = validateStakeholderAnalysisInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when transcript is missing", () => {
    const result = validateStakeholderAnalysisInput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("fails for invalid time_horizon enum value", () => {
    const result = validateStakeholderAnalysisInput({
      transcript: "A".repeat(80),
      time_horizon: "decade",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "enum")).toBe(true);
  });
});

describe("validateStakeholderAnalysisOutput", () => {
  it("passes for sample output fixture", () => {
    const output = loadFixture("stakeholder-analysis.output.example.json");
    const result = validateStakeholderAnalysisOutput(output);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
