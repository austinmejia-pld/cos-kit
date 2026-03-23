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
    signalPhrases: [
      "i'll", "i will", "let me", "i need to", "we should",
      "can you", "follow up", "by friday", "by next week",
      "reach out", "write up", "schedule a", "set up a",
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
    signalPhrases: [
      "risk", "concern", "what if", "assumption", "tension",
      "worried", "unclear", "could go wrong", "we don't know",
      "not defined", "questionable", "potentially",
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
    signalPhrases: [
      "could go wrong", "what if", "failure mode", "too optimistic",
      "strategy", "proposal", "plan", "the idea is", "ship", "launch",
      "doesn't work out",
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
    signalPhrases: [
      "tell me about a time", "walk me through", "your background",
      "previous role", "candidate", "interviewer", "hiring manager",
      "years of experience",
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
    signalPhrases: [],
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

// ── Transcript routing tests ─────────────────────────────────────────

const PRODUCT_MEETING_TRANSCRIPT = `
  So I think we should probably follow up on the budget issue. I'll reach out
  to Peter and co to get traction on this. Let me write up a few scenarios
  for the demo. I need to figure out who is in charge of memory and find the
  PRD. We should schedule a meeting next week to align on the roadmap.
  The concern is that things are kind of disconnected and nobody really has
  an idea of what other people are doing. I don't disagree with you, but I think
  the company is hitting a point where information just doesn't permeate as quickly.
  Let me do two things. One, let me reach out and figure out if someone is in
  charge of memory. Two, let me write up a few of these scenarios.
  I'm still trying to figure out the best approach. We should set up a call
  with the team by Friday. The goal would be to ship something within the quarter.
  I think my suggestion would be if we think there's something fundamentally wrong
  we should raise it up now, and if not I think we can let these features bake.
`.repeat(3); // Repeat to ensure >500 chars

describe("routeSkill — transcript mode", () => {
  it("suggests commitment-extractor for transcript with action language", async () => {
    const result = await routeSkill(
      { userMessage: PRODUCT_MEETING_TRANSCRIPT },
      CATALOG,
    );
    expect(result.decision).toBe("SUGGEST_SKILL");
    expect(result.suggestions).toBeDefined();
    const skillIds = result.suggestions!.map((s) => s.skillId);
    expect(skillIds).toContain("commitment-extractor");
  });

  it("scores above threshold for risk-laden transcript", async () => {
    const riskTranscript = `
      The concern is that we don't know what the user experience will look like.
      It's unclear who owns the integration. What if the API breaks? There's
      tension between the teams about the timeline. The assumption is that we can
      ship by Q2, but that feels questionable. We're worried about the dependency
      on the calendar team. The risk is that we launch without proper testing.
      I'm not sure if we have buy-in from leadership. There could be pushback
      if things go wrong. Potentially we need to rethink the whole approach.
    `.repeat(3);
    const result = await routeSkill(
      { userMessage: riskTranscript },
      CATALOG,
    );
    expect(result.decision).toBe("SUGGEST_SKILL");
    const skillIds = result.suggestions!.map((s) => s.skillId);
    expect(skillIds).toContain("meeting-risk-analysis");
  });

  it("returns NO_SKILL for long but irrelevant text", async () => {
    const irrelevant = "The quick brown fox jumps over the lazy dog. ".repeat(50);
    const result = await routeSkill(
      { userMessage: irrelevant },
      CATALOG,
    );
    expect(result.decision).toBe("NO_SKILL");
  });

  it("still works for short queries (original mode)", async () => {
    const result = await routeSkill(
      { userMessage: "extract commitments from this meeting" },
      CATALOG,
    );
    expect(result.decision).toBe("SUGGEST_SKILL");
    expect(result.suggestions![0].skillId).toBe("commitment-extractor");
  });
});
