import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommitmentExtractor } from "../src/skills/commitment-extractor/index.js";
import type { LLMClient } from "../src/skills/commitment-extractor/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../fixtures");

function loadFixture(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(FIXTURES, filename), "utf-8"));
}

function mockClient(response: string): LLMClient {
  return { chat: async () => response };
}

const TRANSCRIPT_ONLY_INPUT = loadFixture(
  "commitment-extractor.input.transcript-only.json",
);
const WITH_CONTEXT_INPUT = loadFixture(
  "commitment-extractor.input.with-context.json",
);
const VALID_OUTPUT = loadFixture(
  "commitment-extractor.output.example.json",
) as Record<string, unknown>;

// Minimal valid LLM response with one commitment — used as base for targeted tests
function minimalOutput(overrides?: Record<string, unknown>): string {
  const base = {
    summary: "1 commitment extracted.",
    commitments: [
      {
        id: "CMT-001",
        commitment_text: "Send the revised budget",
        commitment_type: "deliverable",
        owner: "Alice",
        owner_confidence: "high",
        due_date_raw: "by Friday",
        due_date_normalized: "2026-03-20",
        status: "new",
        priority: "high",
        proof_artifact_expected: "Budget doc shared",
        dependencies: [],
        blockers: [],
        source_evidence: [
          {
            speaker: "Alice",
            quote: "I'll send the revised budget by Friday.",
            approximate_location: "opening",
          },
        ],
        confidence_score: 0.92,
      },
    ],
    unassigned_actions: [],
    missing_fields: [],
    owner_rollup: [{ owner: "Alice", count: 1, critical_count: 0 }],
    metadata: {
      mode_used: "transcript_only",
      generated_at: "2026-03-12T10:00:00Z",
    },
  };
  return JSON.stringify({ ...base, ...overrides });
}

// ── Happy path ──────────────────────────────────────────────────────

describe("runCommitmentExtractor — happy path", () => {
  it("returns ok:true for transcript-only input with valid LLM output", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runCommitmentExtractor(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.commitments.length).toBeGreaterThanOrEqual(4);
    expect(result.data.metadata.mode_used).toBe("transcript_only");
    expect(result.diagnostics.warnings).toBeDefined();
  });

  it("sets mode_used to transcript_plus_context when context fields present", async () => {
    const client = mockClient(JSON.stringify(VALID_OUTPUT));
    const result = await runCommitmentExtractor(WITH_CONTEXT_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.metadata.mode_used).toBe("transcript_plus_context");
  });
});

// ── Input validation ────────────────────────────────────────────────

describe("runCommitmentExtractor — input validation", () => {
  it("returns ok:false with validation errors for empty input", async () => {
    const client = mockClient("{}");
    const result = await runCommitmentExtractor({}, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Input validation failed");
    expect(result.validation_errors).toBeDefined();
    expect(
      result.validation_errors!.some((e) => e.keyword === "required"),
    ).toBe(true);
  });
});

// ── LLM failure modes ───────────────────────────────────────────────

describe("runCommitmentExtractor — LLM response handling", () => {
  it("returns ok:false when LLM returns non-JSON garbage", async () => {
    const client = mockClient(
      "I'm sorry, I can't extract commitments from this transcript.",
    );
    const result = await runCommitmentExtractor(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("invalid JSON");
  });

  it("strips markdown fences and parses successfully", async () => {
    const fenced = "```json\n" + minimalOutput() + "\n```";
    const client = mockClient(fenced);
    const result = await runCommitmentExtractor(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.commitments.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Mapper: confidence heuristic ────────────────────────────────────

describe("runCommitmentExtractor — confidence heuristic", () => {
  it("nudges confidence up when owner is explicit with due date and evidence", async () => {
    const output = {
      summary: "1 commitment.",
      commitments: [
        {
          id: "CMT-001",
          commitment_text: "Deliver the report",
          commitment_type: "deliverable",
          owner: "Bob",
          owner_confidence: "high",
          due_date_raw: "next Monday",
          due_date_normalized: "2026-03-16",
          status: "new",
          priority: "high",
          proof_artifact_expected: "Report shared",
          dependencies: [],
          blockers: [],
          source_evidence: [
            {
              speaker: "Bob",
              quote: "I'll deliver the report by next Monday.",
              approximate_location: "closing",
            },
          ],
          confidence_score: 0.5,
        },
      ],
      unassigned_actions: [],
      missing_fields: [],
      owner_rollup: [{ owner: "Bob", count: 1, critical_count: 0 }],
      metadata: {
        mode_used: "transcript_only",
        generated_at: "2026-03-12T00:00:00Z",
      },
    };

    const client = mockClient(JSON.stringify(output));
    const result = await runCommitmentExtractor(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Heuristic should nudge 0.5 up to at least 0.85
    expect(result.data.commitments[0].confidence_score).toBeGreaterThanOrEqual(
      0.85,
    );
  });
});

// ── Mapper: deduplication ───────────────────────────────────────────

describe("runCommitmentExtractor — deduplication", () => {
  it("merges near-identical commitments from the same owner", async () => {
    const output = {
      summary: "2 commitments.",
      commitments: [
        {
          id: "CMT-001",
          commitment_text:
            "Prepare revised go-to-market plan with Singapore as lead market and Japan follow-on",
          commitment_type: "deliverable",
          owner: "Kenji Tanaka",
          owner_confidence: "high",
          due_date_raw: "next Friday",
          due_date_normalized: "2026-03-20",
          status: "new",
          priority: "critical",
          proof_artifact_expected: "Plan document",
          dependencies: [],
          blockers: [],
          source_evidence: [
            {
              speaker: "Ravi Patel",
              quote:
                "Kenji, can you put together a revised plan with Singapore as the lead market?",
              approximate_location: "closing",
            },
          ],
          confidence_score: 0.9,
        },
        {
          id: "CMT-002",
          commitment_text:
            "Prepare revised go-to-market plan with Singapore as lead market and Japan as phased follow-on",
          commitment_type: "deliverable",
          owner: "Kenji Tanaka",
          owner_confidence: "high",
          due_date_raw: "next Friday",
          due_date_normalized: "2026-03-20",
          status: "new",
          priority: "critical",
          proof_artifact_expected: "Plan document shared",
          dependencies: [],
          blockers: [],
          source_evidence: [
            {
              speaker: "Kenji Tanaka",
              quote: "I can have a draft by next Friday.",
              approximate_location: "closing",
            },
          ],
          confidence_score: 0.88,
        },
      ],
      unassigned_actions: [],
      missing_fields: [],
      owner_rollup: [{ owner: "Kenji Tanaka", count: 2, critical_count: 2 }],
      metadata: {
        mode_used: "transcript_only",
        generated_at: "2026-03-12T00:00:00Z",
      },
    };

    const client = mockClient(JSON.stringify(output));
    const result = await runCommitmentExtractor(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.commitments).toHaveLength(1);
    // Evidence from both originals should be merged
    expect(
      result.data.commitments[0].source_evidence.length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      result.diagnostics.warnings.some((w) => w.includes("deduplicated")),
    ).toBe(true);
  });
});

// ── Mapper: owner_rollup recompute ──────────────────────────────────

describe("runCommitmentExtractor — owner rollup", () => {
  it("recomputes owner_rollup from commitments even when LLM counts are wrong", async () => {
    const output = {
      summary: "2 commitments.",
      commitments: [
        {
          id: "CMT-001",
          commitment_text: "Task A",
          commitment_type: "deliverable",
          owner: "Alice",
          owner_confidence: "high",
          due_date_raw: "Friday",
          due_date_normalized: "",
          status: "new",
          priority: "critical",
          proof_artifact_expected: "Doc",
          dependencies: [],
          blockers: [],
          source_evidence: [
            { speaker: "Alice", quote: "I'll do task A.", approximate_location: "mid" },
          ],
          confidence_score: 0.9,
        },
        {
          id: "CMT-002",
          commitment_text: "Task B",
          commitment_type: "follow_up",
          owner: "Bob",
          owner_confidence: "high",
          due_date_raw: "Monday",
          due_date_normalized: "",
          status: "new",
          priority: "medium",
          proof_artifact_expected: "Email",
          dependencies: [],
          blockers: [],
          source_evidence: [
            { speaker: "Bob", quote: "I'll handle task B.", approximate_location: "end" },
          ],
          confidence_score: 0.85,
        },
      ],
      unassigned_actions: [],
      missing_fields: [],
      owner_rollup: [
        { owner: "Alice", count: 99, critical_count: 99 },
        { owner: "Bob", count: 99, critical_count: 99 },
      ],
      metadata: {
        mode_used: "transcript_only",
        generated_at: "2026-03-12T00:00:00Z",
      },
    };

    const client = mockClient(JSON.stringify(output));
    const result = await runCommitmentExtractor(TRANSCRIPT_ONLY_INPUT, client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const aliceRollup = result.data.owner_rollup.find(
      (r) => r.owner === "Alice",
    );
    const bobRollup = result.data.owner_rollup.find((r) => r.owner === "Bob");

    expect(aliceRollup).toEqual({ owner: "Alice", count: 1, critical_count: 1 });
    expect(bobRollup).toEqual({ owner: "Bob", count: 1, critical_count: 0 });
    expect(
      result.diagnostics.warnings.some((w) => w.includes("owner_rollup")),
    ).toBe(true);
  });
});
