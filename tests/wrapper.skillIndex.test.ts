import { describe, it, expect } from "vitest";
import { buildIndex } from "../src/wrapper/skillIndex.js";

const SAMPLE_ENTRIES = [
  {
    id: "commitment-extractor",
    description: "Extract commitments and action items from meeting transcripts",
    command: "/commitments",
    status: "active" as const,
    triggerExamples: ["extract commitments", "pull action items"],
    requiredInputs: ["transcript"],
    fallbackPrompt: "I need a transcript.",
  },
  {
    id: "meeting-risk-analysis",
    description: "Surface risks and tensions from meeting transcripts",
    command: "/risks",
    status: "active" as const,
    triggerExamples: ["find risks in this meeting", "risk assessment"],
    requiredInputs: ["transcript"],
    fallbackPrompt: "I need a transcript.",
  },
  {
    id: "interview-analysis",
    description: "Analyze an interview transcript against a rubric",
    command: "/interview",
    status: "active" as const,
    triggerExamples: ["evaluate this interview", "score this candidate"],
    requiredInputs: ["transcript", "role", "rubric"],
    fallbackPrompt: "I need a transcript and rubric.",
  },
];

describe("buildIndex", () => {
  const indexed = buildIndex(SAMPLE_ENTRIES);

  it("produces SkillMeta for each entry", () => {
    expect(indexed).toHaveLength(3);
    expect(indexed[0].id).toBe("commitment-extractor");
  });

  it("derives keywords from description and triggers", () => {
    const commitments = indexed[0];
    expect(commitments.keywords.length).toBeGreaterThan(0);
    expect(commitments.keywords).toContain("commitment");
    expect(commitments.keywords).toContain("extract");
  });

  it("derives anti-keywords from other skills", () => {
    const commitments = indexed[0];
    // "risk" is a keyword of meeting-risk-analysis but not commitment-extractor
    expect(commitments.antiKeywords).toContain("risk");
  });

  it("does not include own keywords as anti-keywords", () => {
    const commitments = indexed[0];
    for (const kw of commitments.keywords) {
      expect(commitments.antiKeywords).not.toContain(kw);
    }
  });

  it("preserves all original fields", () => {
    const entry = indexed[1];
    expect(entry.command).toBe("/risks");
    expect(entry.status).toBe("active");
    expect(entry.requiredInputs).toEqual(["transcript"]);
    expect(entry.triggerExamples).toHaveLength(2);
  });
});
