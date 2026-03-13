import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInterviewAnalysis } from "../src/skills/interview-analysis/index.js";
import type { LLMClient } from "../src/skills/interview-analysis/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

function mockClient(response: string): LLMClient {
  return { chat: async () => response };
}

const VALID_INPUT = loadFixture("interview-analysis.input.json");
const VALID_OUTPUT = loadFixture("interview-analysis.output.example.json") as Record<string, unknown>;

describe("runInterviewAnalysis — happy path", () => {
  it("returns ok:true for valid input with valid LLM output", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runInterviewAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recommendation).toBe("mixed");
    expect(result.data.confidence).toBeGreaterThanOrEqual(0);
    expect(result.data.confidence).toBeLessThanOrEqual(1);
    expect(result.data.dimension_scores.length).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics.warnings).toBeDefined();
  });

  it("clamps scores to 1-4 range", async () => {
    const output = {
      ...VALID_OUTPUT,
      dimension_scores: [
        {
          dimension: "Problem Solving",
          score: 7,
          rationale: "test",
          evidence_quotes: ["quote"],
        },
        {
          dimension: "Execution",
          score: -1,
          rationale: "test",
          evidence_quotes: ["quote"],
        },
        {
          dimension: "Communication",
          score: 3,
          rationale: "test",
          evidence_quotes: ["quote"],
        },
      ],
    };
    const client = mockClient(JSON.stringify(output));
    const result = await runInterviewAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.dimension_scores[0].score).toBe(4);
    expect(result.data.dimension_scores[1].score).toBe(1);
    expect(result.data.dimension_scores[2].score).toBe(3);
  });

  it("normalizes recommendation enum variants", async () => {
    const output = { ...VALID_OUTPUT, recommendation: "Strong Yes" };
    const client = mockClient(JSON.stringify(output));
    const result = await runInterviewAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recommendation).toBe("strong_yes");
  });

  it("adds placeholder for missing rubric dimensions", async () => {
    const output = {
      ...VALID_OUTPUT,
      dimension_scores: [
        {
          dimension: "Problem Solving",
          score: 3,
          rationale: "test",
          evidence_quotes: ["quote"],
        },
      ],
    };
    const client = mockClient(JSON.stringify(output));
    const result = await runInterviewAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.dimension_scores.length).toBe(3);
    expect(
      result.diagnostics.warnings.some((w) => w.includes("missing from LLM output")),
    ).toBe(true);
  });

  it("clamps confidence to 0-1 range", async () => {
    const output = { ...VALID_OUTPUT, confidence: 5.0 };
    const client = mockClient(JSON.stringify(output));
    const result = await runInterviewAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.confidence).toBe(1);
  });
});

describe("runInterviewAnalysis — input validation", () => {
  it("returns ok:false for empty input", async () => {
    const client = mockClient("{}");
    const result = await runInterviewAnalysis({}, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Input does not conform");
  });

  it("returns ok:false for invalid stage", async () => {
    const client = mockClient("{}");
    const input = { ...VALID_INPUT as Record<string, unknown>, stage: "coffee_chat" };
    const result = await runInterviewAnalysis(input, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe("input_validation");
  });
});

describe("runInterviewAnalysis — LLM response handling", () => {
  it("returns ok:false when LLM returns non-JSON", async () => {
    const client = mockClient("I cannot evaluate this candidate.");
    const result = await runInterviewAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("invalid JSON");
  });

  it("strips markdown fences and parses", async () => {
    const fenced = "```json\n" + JSON.stringify(VALID_OUTPUT) + "\n```";
    const client = mockClient(fenced);
    const result = await runInterviewAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recommendation).toBe("mixed");
  });

  it("returns ok:false when LLM call throws", async () => {
    const client: LLMClient = {
      chat: async () => { throw new Error("context window exceeded"); },
    };
    const result = await runInterviewAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("context window exceeded");
  });
});
