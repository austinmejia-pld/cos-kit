import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRedteam } from "../src/skills/redteam/index.js";
import type { LLMClient } from "../src/skills/redteam/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

function mockClient(response: string): LLMClient {
  return { chat: async () => response };
}

const TRANSCRIPT_ONLY_INPUT = loadFixture("redteam.input.transcript-only.json");
const WITH_FOCUS_INPUT = loadFixture("redteam.input.with-focus.json");
const VALID_OUTPUT = loadFixture("redteam.output.example.json") as Record<string, unknown>;

describe("runRedteam — happy path", () => {
  it("returns ok:true for transcript-only input with valid LLM output", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runRedteam(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.failure_modes.length).toBeGreaterThanOrEqual(1);
    expect(result.data.metadata.mode_used).toBe("transcript_only");
    expect(result.data.overall_risk_level).toBe("medium");
    expect(result.diagnostics.warnings).toBeDefined();
  });

  it("sets mode_used to transcript_plus_focus when focus fields present", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runRedteam(WITH_FOCUS_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.metadata.mode_used).toBe("transcript_plus_focus");
  });

  it("normalizes failure mode IDs sequentially", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runRedteam(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.data.failure_modes.forEach((fm, i) => {
      expect(fm.id).toBe(`FM-${String(i + 1).padStart(3, "0")}`);
    });
  });

  it("clamps severity and likelihood to 1-5 range", async () => {
    const output = {
      ...VALID_OUTPUT,
      failure_modes: [
        {
          id: "FM-001",
          title: "Test failure",
          severity: 10,
          likelihood: -1,
          why_it_fails: "test",
          leading_indicators: ["test"],
          mitigation: "test",
        },
      ],
    };
    const client = mockClient(JSON.stringify(output));
    const result = await runRedteam(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.failure_modes[0].severity).toBe(5);
    expect(result.data.failure_modes[0].likelihood).toBe(1);
  });
});

describe("runRedteam — input validation", () => {
  it("returns ok:false for empty input", async () => {
    const client = mockClient("{}");
    const result = await runRedteam({}, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("Input does not conform");
  });

  it("returns ok:false for short transcript", async () => {
    const client = mockClient("{}");
    const result = await runRedteam({ transcript: "too short" }, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.stage).toBe("input_validation");
  });
});

describe("runRedteam — LLM response handling", () => {
  it("returns ok:false when LLM returns non-JSON", async () => {
    const client = mockClient("I cannot perform adversarial analysis.");
    const result = await runRedteam(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("invalid JSON");
  });

  it("strips markdown fences and parses", async () => {
    const fenced = "```json\n" + JSON.stringify(VALID_OUTPUT) + "\n```";
    const client = mockClient(fenced);
    const result = await runRedteam(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.failure_modes.length).toBeGreaterThanOrEqual(1);
  });

  it("returns ok:false when LLM call throws", async () => {
    const client: LLMClient = {
      chat: async () => { throw new Error("rate limit"); },
    };
    const result = await runRedteam(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("rate limit");
  });
});

describe("runRedteam — deduplication", () => {
  it("deduplicates failure modes with overlapping titles", async () => {
    const output = {
      ...VALID_OUTPUT,
      failure_modes: [
        {
          id: "FM-001",
          title: "Japanese invoicing non-compliance blocks enterprise sales",
          severity: 4, likelihood: 4,
          why_it_fails: "test", leading_indicators: ["a"], mitigation: "fix",
        },
        {
          id: "FM-002",
          title: "Japanese invoicing non-compliance blocks enterprise sales",
          severity: 3, likelihood: 3,
          why_it_fails: "test2", leading_indicators: ["b"], mitigation: "fix2",
        },
      ],
    };
    const client = mockClient(JSON.stringify(output));
    const result = await runRedteam(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.failure_modes).toHaveLength(1);
    expect(result.data.failure_modes[0].severity).toBe(4);
    expect(result.diagnostics.warnings.some((w) => w.includes("deduplicated"))).toBe(true);
  });
});
