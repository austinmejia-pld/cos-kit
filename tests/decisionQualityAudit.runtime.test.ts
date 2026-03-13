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

// ── Happy path ──────────────────────────────────────────────────────

describe("runDecisionQualityAudit — happy path", () => {
  it("returns ok:true for transcript-only input with valid LLM output", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.gaps.length).toBeGreaterThanOrEqual(2);
    expect(result.data.assumptions.length).toBeGreaterThanOrEqual(3);
    expect(result.data.citations.length).toBeGreaterThanOrEqual(2);
    expect(result.data.metadata.mode_used).toBe("transcript_only");
    expect(result.diagnostics.warnings).toBeDefined();
    expect(result.diagnostics.low_confidence_sections).toBeDefined();
    expect(result.diagnostics.inferred_fields).toBeDefined();
  });

  it("sets mode_used to transcript_plus_context when context fields present", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runDecisionQualityAudit(WITH_CONTEXT_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.metadata.mode_used).toBe("transcript_plus_context");
  });
});

// ── Input validation ────────────────────────────────────────────────

describe("runDecisionQualityAudit — input validation", () => {
  it("returns ok:false with stage input_validation for empty input", async () => {
    const client = mockClient("{}");
    const result = await runDecisionQualityAudit({}, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe("input_validation");
    expect(result.error.details).toBeDefined();
  });
});

// ── LLM failure modes ───────────────────────────────────────────────

describe("runDecisionQualityAudit — LLM response handling", () => {
  it("returns ok:false with stage json_parse when LLM returns non-JSON", async () => {
    const client = mockClient(
      "I'm sorry, I can't audit decisions from this transcript.",
    );
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe("json_parse");
    expect(result.error.message).toContain("invalid JSON");
  });

  it("strips markdown fences and parses successfully", async () => {
    const fenced = "```json\n" + JSON.stringify(VALID_OUTPUT) + "\n```";
    const client = mockClient(fenced);
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.decision_quality_score).toBeGreaterThanOrEqual(0);
  });
});

// ── Mapper: score clamping ──────────────────────────────────────────

describe("runDecisionQualityAudit — score clamping", () => {
  it("clamps scores above 100 to 100", async () => {
    const inflated = {
      ...VALID_OUTPUT,
      decision_quality_score: 150,
      score_breakdown: {
        clarity_of_decision: 200,
        evidence_quality: -10,
        alternatives_considered: 50,
        risk_assessment_quality: 60,
        ownership_and_accountability: 70,
        reversibility_and_checkpoints: 999,
      },
    };
    const client = mockClient(JSON.stringify(inflated));
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.decision_quality_score).toBe(100);
    expect(result.data.score_breakdown.clarity_of_decision).toBe(100);
    expect(result.data.score_breakdown.evidence_quality).toBe(0);
    expect(result.data.score_breakdown.reversibility_and_checkpoints).toBe(100);
  });
});

// ── Integration: dispatch success ───────────────────────────────────

describe("runDecisionQualityAudit — integration dispatch", () => {
  it("produces a complete output with all required fields", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runDecisionQualityAudit(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const data = result.data;
    expect(typeof data.executive_summary).toBe("string");
    expect(typeof data.decision_surface).toBe("string");
    expect(["clear_decision", "tentative_decision", "no_decision"]).toContain(
      data.decision_status,
    );
    expect(data.decision_quality_score).toBeGreaterThanOrEqual(0);
    expect(data.decision_quality_score).toBeLessThanOrEqual(100);
    expect(data.score_breakdown).toBeDefined();
    expect(Array.isArray(data.strengths)).toBe(true);
    expect(Array.isArray(data.gaps)).toBe(true);
    expect(Array.isArray(data.assumptions)).toBe(true);
    expect(Array.isArray(data.alternatives_missing)).toBe(true);
    expect(Array.isArray(data.risks_underweighted)).toBe(true);
    expect(Array.isArray(data.accountability_snapshot)).toBe(true);
    expect(Array.isArray(data.decision_hygiene_upgrades_next_meeting)).toBe(
      true,
    );
    expect(data.single_most_important_upgrade).toBeDefined();
    expect(Array.isArray(data.citations)).toBe(true);
    expect(data.metadata.mode_used).toBeDefined();
    expect(data.metadata.generated_at).toBeDefined();
  });
});
