import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runDecisionQualityAudit } from "../src/skills/decision-quality-audit/index.js";
import type { LLMClient } from "../src/skills/decision-quality-audit/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

function mockClient(response: string): LLMClient {
  return { chat: async () => response };
}

const TRANSCRIPT_ONLY_INPUT = loadFixture(
  "decision-quality-audit.input.transcript-only.json",
);
const WITH_CONTEXT_INPUT = loadFixture(
  "decision-quality-audit.input.with-context.json",
);
const VALID_OUTPUT = loadFixture(
  "decision-quality-audit.output.example.json",
) as Record<string, unknown>;

describe("runDecisionQualityAudit — happy path", () => {
  it("returns ok:true for transcript-only input with valid LLM output", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.decision_quality_score).toBe(62);
    expect(result.data.metadata.mode_used).toBe("transcript_only");
    expect(result.data.gaps.length).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics.warnings).toBeDefined();
  });

  it("sets mode_used to transcript_plus_context when context fields present", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runDecisionQualityAudit(WITH_CONTEXT_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.metadata.mode_used).toBe("transcript_plus_context");
  });

  it("returns score_breakdown with all six dimensions", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sb = result.data.score_breakdown;
    expect(sb.clarity_of_decision).toBeGreaterThanOrEqual(0);
    expect(sb.evidence_quality).toBeGreaterThanOrEqual(0);
    expect(sb.alternatives_considered).toBeGreaterThanOrEqual(0);
    expect(sb.risk_assessment_quality).toBeGreaterThanOrEqual(0);
    expect(sb.ownership_and_accountability).toBeGreaterThanOrEqual(0);
    expect(sb.reversibility_and_checkpoints).toBeGreaterThanOrEqual(0);
  });
});

describe("runDecisionQualityAudit — input validation", () => {
  it("returns ok:false with validation errors for empty input", async () => {
    const client = mockClient("{}");
    const result = await runDecisionQualityAudit({}, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Input does not conform");
    expect(result.error.details).toBeDefined();
  });
});

describe("runDecisionQualityAudit — LLM response handling", () => {
  it("returns ok:false when LLM returns non-JSON", async () => {
    const client = mockClient("Sorry, I cannot analyze this transcript.");
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("invalid JSON");
  });

  it("strips markdown fences and parses successfully", async () => {
    const fenced = "```json\n" + JSON.stringify(VALID_OUTPUT) + "\n```";
    const client = mockClient(fenced);
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.decision_quality_score).toBe(62);
  });

  it("returns ok:false when LLM call throws", async () => {
    const client: LLMClient = {
      chat: async () => { throw new Error("network timeout"); },
    };
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("network timeout");
  });
});

describe("runDecisionQualityAudit — diagnostics", () => {
  it("flags low-confidence sections when score < 40", async () => {
    const output = {
      ...VALID_OUTPUT,
      score_breakdown: {
        clarity_of_decision: 75,
        evidence_quality: 70,
        alternatives_considered: 30,
        risk_assessment_quality: 55,
        ownership_and_accountability: 65,
        reversibility_and_checkpoints: 20,
      },
    };
    const client = mockClient(JSON.stringify(output));
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagnostics.low_confidence_sections).toContain(
      "alternatives_considered",
    );
    expect(result.diagnostics.low_confidence_sections).toContain(
      "reversibility_and_checkpoints",
    );
  });
});
