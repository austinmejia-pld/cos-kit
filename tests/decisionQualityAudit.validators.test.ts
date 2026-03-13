import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateDecisionQualityAuditInput,
  validateDecisionQualityAuditOutput,
} from "../src/validators/decisionQualityAudit.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

describe("validateDecisionQualityAuditInput", () => {
  it("passes for transcript-only mode fixture", () => {
    const input = loadFixture(
      "decision-quality-audit.input.transcript-only.json",
    );
    const result = validateDecisionQualityAuditInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes for transcript + context mode fixture", () => {
    const input = loadFixture(
      "decision-quality-audit.input.with-context.json",
    );
    const result = validateDecisionQualityAuditInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when transcript is missing", () => {
    const result = validateDecisionQualityAuditInput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("fails for invalid risk_tolerance enum value", () => {
    const result = validateDecisionQualityAuditInput({
      transcript: "A".repeat(100),
      risk_tolerance: "extreme",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "enum")).toBe(true);
  });
});

describe("validateDecisionQualityAuditOutput", () => {
  it("passes for sample output fixture", () => {
    const output = loadFixture("decision-quality-audit.output.example.json");
    const result = validateDecisionQualityAuditOutput(output);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
