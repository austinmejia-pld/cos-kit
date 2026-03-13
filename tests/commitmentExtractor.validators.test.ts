import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateCommitmentExtractorInput,
  validateCommitmentExtractorOutput,
} from "../src/validators/commitmentExtractor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

describe("validateCommitmentExtractorInput", () => {
  it("passes for transcript-only mode fixture", () => {
    const input = loadFixture(
      "commitment-extractor.input.transcript-only.json",
    );
    const result = validateCommitmentExtractorInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("passes for transcript + context mode fixture", () => {
    const input = loadFixture(
      "commitment-extractor.input.with-context.json",
    );
    const result = validateCommitmentExtractorInput(input);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when transcript is missing", () => {
    const result = validateCommitmentExtractorInput({});
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "required")).toBe(true);
  });

  it("fails for invalid extraction_mode enum value", () => {
    const result = validateCommitmentExtractorInput({
      transcript: "A".repeat(80),
      extraction_mode: "aggressive",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.keyword === "enum")).toBe(true);
  });
});

describe("validateCommitmentExtractorOutput", () => {
  it("passes for sample output fixture", () => {
    const output = loadFixture("commitment-extractor.output.example.json");
    const result = validateCommitmentExtractorOutput(output);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
