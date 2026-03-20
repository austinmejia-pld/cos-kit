import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateEffectiveCommunicationInput,
  validateEffectiveCommunicationOutput,
} from "../src/validators/effectiveCommunication.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

describe("validateEffectiveCommunicationInput", () => {
  it("passes for transcript-only mode fixture", () => {
    const input = loadFixture(
      "effective-communication.input.transcript-only.json",
    );
    const result = validateEffectiveCommunicationInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes for transcript + context mode fixture", () => {
    const input = loadFixture(
      "effective-communication.input.with-context.json",
    );
    const result = validateEffectiveCommunicationInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when transcript is missing", () => {
    const result = validateEffectiveCommunicationInput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("fails for invalid tone_target enum value", () => {
    const result = validateEffectiveCommunicationInput({
      transcript: "A".repeat(200),
      tone_target: "aggressive",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "enum")).toBe(true);
  });
});

describe("validateEffectiveCommunicationOutput", () => {
  it("fails when priority_improvements has fewer than 3 items", () => {
    const output = loadFixture(
      "effective-communication.output.example.json",
    ) as Record<string, unknown>;
    const mutated = {
      ...output,
      priority_improvements: (
        output.priority_improvements as unknown[]
      ).slice(0, 1),
    };
    const result = validateEffectiveCommunicationOutput(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "minItems")).toBe(true);
  });

  it("passes for sample output fixture", () => {
    const output = loadFixture("effective-communication.output.example.json");
    const result = validateEffectiveCommunicationOutput(output);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
