import { describe, it, expect } from "vitest";
import { routeSkill, formatSuggestion } from "../src/wrapper/skillRouter.js";
import { buildIndex } from "../src/wrapper/skillIndex.js";
import type { SkillMeta, RouterDecision } from "../src/wrapper/routerTypes.js";

// ── Test catalog ────────────────────────────────────────────────────

const RAW_ENTRIES = [
  {
    id: "commitment-extractor",
    description: "Extract commitments and action items from meeting transcripts with owners and deadlines",
    command: "/commitments",
    status: "active" as const,
    triggerExamples: [
      "extract commitments from this meeting",
      "what did people commit to",
      "pull action items and owners",
    ],
    requiredInputs: ["transcript"],
    fallbackPrompt: "I need a transcript.",
  },
  {
    id: "meeting-risk-analysis",
    description: "Surface risks, tensions, hidden assumptions and decision gaps from meeting transcripts",
    command: "/risks",
    status: "active" as const,
    triggerExamples: [
      "what are the risks from this meeting",
      "surface risks in this transcript",
      "find hidden assumptions",
    ],
    requiredInputs: ["transcript"],
    fallbackPrompt: "I need a transcript.",
  },
  {
    id: "redteam",
    description: "Adversarial analysis to stress-test a strategy, proposal, or plan",
    command: "/redteam",
    status: "active" as const,
    triggerExamples: [
      "stress test this idea",
      "red team this proposal",
      "poke holes in this plan",
    ],
    requiredInputs: ["transcript"],
    fallbackPrompt: "I need a transcript.",
  },
  {
    id: "interview-analysis",
    description: "Analyze interview transcript against a role rubric with dimension scores and hire recommendation",
    command: "/interview",
    status: "active" as const,
    triggerExamples: [
      "evaluate this interview transcript",
      "score this interview",
      "assess candidate performance",
    ],
    requiredInputs: ["transcript", "role", "stage", "rubric"],
    fallbackPrompt: "I need a transcript, role, stage, and rubric.",
  },
  {
    id: "planned-skill",
    description: "A planned skill that is not yet active",
    command: "/planned",
    status: "planned" as const,
    triggerExamples: ["do something planned"],
    requiredInputs: ["transcript"],
    fallbackPrompt: "Not ready yet.",
  },
];

const CATALOG: SkillMeta[] = buildIndex(RAW_ENTRIES);

// ── routeSkill tests ────────────────────────────────────────────────

describe("routeSkill", () => {
  it("returns SUGGEST_SKILL for a clear trigger match", async () => {
    const result = await routeSkill(
      { userMessage: "extract commitments from this meeting" },
      CATALOG,
    );
    expect(result.decision).toBe("SUGGEST_SKILL");
    expect(result.suggestions).toBeDefined();
    expect(result.suggestions![0].skillId).toBe("commitment-extractor");
    expect(result.suggestions![0].command).toBe("/commitments");
    expect(result.engine).toBe("keyword");
  });

  it("returns SUGGEST_SKILL for interview-related input", async () => {
    const result = await routeSkill(
      { userMessage: "evaluate this interview transcript" },
      CATALOG,
    );
    expect(result.decision).toBe("SUGGEST_SKILL");
    expect(result.suggestions![0].skillId).toBe("interview-analysis");
  });

  it("returns NO_SKILL for unrelated input", async () => {
    const result = await routeSkill(
      { userMessage: "what is the weather today" },
      CATALOG,
    );
    expect(result.decision).toBe("NO_SKILL");
  });

  it("returns NO_SKILL for empty catalog", async () => {
    const result = await routeSkill(
      { userMessage: "extract commitments" },
      [],
    );
    expect(result.decision).toBe("NO_SKILL");
  });

  it("filters out planned skills", async () => {
    const result = await routeSkill(
      { userMessage: "do something planned" },
      CATALOG,
    );
    // Should not suggest the planned skill
    if (result.suggestions) {
      for (const s of result.suggestions) {
        expect(s.skillId).not.toBe("planned-skill");
      }
    }
  });

  it("includes missing inputs in suggestion", async () => {
    const result = await routeSkill(
      { userMessage: "evaluate this interview transcript", availableInputs: ["transcript"] },
      CATALOG,
    );
    expect(result.suggestions![0].missingInputs).toContain("role");
    expect(result.suggestions![0].missingInputs).toContain("rubric");
  });

  it("computes missing inputs against available inputs", async () => {
    const result = await routeSkill(
      {
        userMessage: "extract commitments from this meeting",
        availableInputs: ["transcript"],
      },
      CATALOG,
    );
    expect(result.suggestions![0].missingInputs).toEqual([]);
  });

  it("measures latency", async () => {
    const result = await routeSkill(
      { userMessage: "extract commitments" },
      CATALOG,
    );
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("never throws on any input", async () => {
    const inputs = [
      "",
      "   ",
      "🎉🎉🎉",
      "a".repeat(10000),
      "/commitments", // slash command — router still processes it
    ];
    for (const msg of inputs) {
      const result = await routeSkill({ userMessage: msg }, CATALOG);
      expect(result).toBeDefined();
      expect(["NO_SKILL", "SUGGEST_SKILL", "ASK_CLARIFY"]).toContain(result.decision);
    }
  });
});

// ── formatSuggestion tests ──────────────────────────────────────────

describe("formatSuggestion", () => {
  it("returns empty string for NO_SKILL", () => {
    const decision: RouterDecision = {
      decision: "NO_SKILL",
      engine: "keyword",
      latencyMs: 0,
    };
    expect(formatSuggestion(decision, CATALOG)).toBe("");
  });

  it("formats single confident suggestion", () => {
    const decision: RouterDecision = {
      decision: "SUGGEST_SKILL",
      suggestions: [{
        skillId: "commitment-extractor",
        score: 0.85,
        rationale: "Matched with 85% confidence",
        command: "/commitments",
        missingInputs: [],
      }],
      engine: "keyword",
      latencyMs: 5,
    };
    const text = formatSuggestion(decision, CATALOG);
    expect(text).toContain("/commitments");
    expect(text).toContain("Looks like");
  });

  it("formats hedged suggestion with missing inputs", () => {
    const decision: RouterDecision = {
      decision: "SUGGEST_SKILL",
      suggestions: [{
        skillId: "interview-analysis",
        score: 0.55,
        rationale: "Possible match",
        command: "/interview",
        missingInputs: ["role", "rubric"],
      }],
      engine: "keyword",
      latencyMs: 3,
    };
    const text = formatSuggestion(decision, CATALOG);
    expect(text).toContain("/interview");
    expect(text).toContain("You might want");
    expect(text).toContain("role");
    expect(text).toContain("rubric");
  });

  it("formats clarification with two options", () => {
    const decision: RouterDecision = {
      decision: "ASK_CLARIFY",
      clarifyQuestion: "Are you looking to use /risks or /redteam?",
      clarifyAmong: ["meeting-risk-analysis", "redteam"],
      engine: "keyword",
      latencyMs: 2,
    };
    const text = formatSuggestion(decision, CATALOG);
    expect(text).toContain("/risks");
    expect(text).toContain("/redteam");
    expect(text).toContain("Which sounds closer");
  });

  it("formats multiple low-confidence suggestions", () => {
    const decision: RouterDecision = {
      decision: "SUGGEST_SKILL",
      suggestions: [
        { skillId: "meeting-risk-analysis", score: 0.40, rationale: "", command: "/risks", missingInputs: [] },
        { skillId: "redteam", score: 0.38, rationale: "", command: "/redteam", missingInputs: [] },
      ],
      engine: "keyword",
      latencyMs: 1,
    };
    const text = formatSuggestion(decision, CATALOG);
    expect(text).toContain("/risks");
    expect(text).toContain("/redteam");
    expect(text).toContain("A couple of skills");
  });
});
