import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runMeetingRiskAnalysis } from "../src/skills/meeting-risk-analysis/index.js";
import type { LLMClient } from "../src/skills/meeting-risk-analysis/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

function mockClient(response: string): LLMClient {
  return { chat: async () => response };
}

const VALID_INPUT = loadFixture("meeting-risk-analysis.input.json");
const VALID_OUTPUT = loadFixture("meeting-risk-analysis.output.example.json") as Record<string, unknown>;

describe("runMeetingRiskAnalysis — happy path", () => {
  it("returns ok:true for valid input with valid LLM output", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runMeetingRiskAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.overall_risk_level).toBe("medium");
    expect(result.data.risks.length).toBeGreaterThanOrEqual(1);
    expect(result.data.confidence).toBeGreaterThanOrEqual(0);
    expect(result.data.confidence).toBeLessThanOrEqual(1);
    expect(result.diagnostics.warnings).toBeDefined();
  });

  it("normalizes severity and likelihood enums", async () => {
    const output = {
      ...VALID_OUTPUT,
      risks: [
        {
          title: "Test risk",
          severity: "SEVERE",
          likelihood: "moderate",
          evidence_quotes: ["quote here"],
          impact: "big impact",
          owner: "Alice",
          mitigation: "fix it",
        },
      ],
    };
    const client = mockClient(JSON.stringify(output));
    const result = await runMeetingRiskAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.risks[0].severity).toBe("high");
    expect(result.data.risks[0].likelihood).toBe("medium");
  });

  it("clamps confidence to 0-1 range", async () => {
    const output = { ...VALID_OUTPUT, confidence: 2.5 };
    const client = mockClient(JSON.stringify(output));
    const result = await runMeetingRiskAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.confidence).toBe(1);
  });
});

describe("runMeetingRiskAnalysis — input validation", () => {
  it("returns ok:false for empty input", async () => {
    const client = mockClient("{}");
    const result = await runMeetingRiskAnalysis({}, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Input does not conform");
  });

  it("returns ok:false for missing required fields", async () => {
    const client = mockClient("{}");
    const result = await runMeetingRiskAnalysis({ transcript: "A".repeat(101) }, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe("input_validation");
  });
});

describe("runMeetingRiskAnalysis — LLM response handling", () => {
  it("returns ok:false when LLM returns non-JSON", async () => {
    const client = mockClient("I cannot analyze this meeting.");
    const result = await runMeetingRiskAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("invalid JSON");
  });

  it("strips markdown fences and parses successfully", async () => {
    const fenced = "```json\n" + JSON.stringify(VALID_OUTPUT) + "\n```";
    const client = mockClient(fenced);
    const result = await runMeetingRiskAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.risks.length).toBeGreaterThanOrEqual(1);
  });

  it("returns ok:false when LLM call throws", async () => {
    const client: LLMClient = {
      chat: async () => { throw new Error("service unavailable"); },
    };
    const result = await runMeetingRiskAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("service unavailable");
  });
});

describe("runMeetingRiskAnalysis — deduplication", () => {
  it("deduplicates risks with overlapping titles", async () => {
    const output = {
      ...VALID_OUTPUT,
      risks: [
        {
          title: "Platform API spec gaps threaten migration timeline",
          severity: "high", likelihood: "medium",
          evidence_quotes: ["quote1"], impact: "a", owner: "Dana", mitigation: "fix",
        },
        {
          title: "Platform API spec gaps threaten migration timeline",
          severity: "medium", likelihood: "low",
          evidence_quotes: ["quote2"], impact: "b", owner: "Dana", mitigation: "fix2",
        },
      ],
    };
    const client = mockClient(JSON.stringify(output));
    const result = await runMeetingRiskAnalysis(VALID_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.risks).toHaveLength(1);
    expect(result.data.risks[0].severity).toBe("high");
    expect(result.diagnostics.warnings.some((w) => w.includes("deduplicated"))).toBe(true);
  });
});
