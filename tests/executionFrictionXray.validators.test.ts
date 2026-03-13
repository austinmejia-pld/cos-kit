import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateExecutionFrictionXrayInput,
  validateExecutionFrictionXrayOutput,
} from "../src/validators/executionFrictionXray.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

describe("validateExecutionFrictionXrayInput", () => {
  it("passes for transcript-only mode fixture", () => {
    const input = loadFixture(
      "execution-friction-xray.input.transcript-only.json",
    );
    const result = validateExecutionFrictionXrayInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes for transcript + context mode fixture", () => {
    const input = loadFixture(
      "execution-friction-xray.input.with-context.json",
    );
    const result = validateExecutionFrictionXrayInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when transcript is missing", () => {
    const result = validateExecutionFrictionXrayInput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("fails for invalid urgency_level enum value", () => {
    const result = validateExecutionFrictionXrayInput({
      transcript: "A".repeat(100),
      urgency_level: "extreme",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "enum")).toBe(true);
  });

  it("fails for invalid analysis_depth enum value", () => {
    const result = validateExecutionFrictionXrayInput({
      transcript: "A".repeat(100),
      analysis_depth: "ultra",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "enum")).toBe(true);
  });
});

describe("validateExecutionFrictionXrayOutput", () => {
  it("passes for sample output fixture", () => {
    const output = loadFixture("execution-friction-xray.output.example.json");
    const result = validateExecutionFrictionXrayOutput(output);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
