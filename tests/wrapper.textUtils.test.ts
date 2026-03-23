import { describe, it, expect } from "vitest";
import {
  tokenize,
  bigrams,
  diceCoefficient,
  bestTriggerMatch,
  keywordOverlap,
  antiKeywordPenalty,
  signalPhraseDensity,
} from "../src/wrapper/textUtils.js";

describe("tokenize", () => {
  it("lowercases and removes stop words", () => {
    const tokens = tokenize("Extract the commitments from this meeting");
    expect(tokens).toContain("extract");
    expect(tokens).toContain("commitment");
    expect(tokens).toContain("meet");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("from");
    expect(tokens).not.toContain("this");
  });

  it("deduplicates tokens", () => {
    const tokens = tokenize("risk risk risk analysis");
    expect(tokens.filter((t) => t === "risk").length).toBe(1);
  });

  it("strips punctuation", () => {
    const tokens = tokenize("What's the risk? Find hidden assumptions!");
    expect(tokens).toContain("risk");
    expect(tokens).toContain("hidden");
    expect(tokens).not.toContain("what's");
  });

  it("applies light stemming", () => {
    const tokens = tokenize("commitments decisions execution friction");
    expect(tokens).toContain("commitment");
    expect(tokens).toContain("decision");   // "decisions" → strip 's'
    expect(tokens).toContain("execu");      // "execution" → strip "tion"
    expect(tokens).toContain("fric");       // "friction" → strip "tion"
  });

  it("returns empty for stop-words-only input", () => {
    const tokens = tokenize("the and or but");
    expect(tokens).toEqual([]);
  });
});

describe("bigrams", () => {
  it("generates character bigrams", () => {
    const bg = bigrams("abc");
    expect(bg).toEqual(new Set(["ab", "bc"]));
  });

  it("handles single character", () => {
    const bg = bigrams("a");
    expect(bg.size).toBe(0);
  });

  it("normalizes whitespace", () => {
    const bg = bigrams("a  b");
    expect(bg).toEqual(new Set(["a ", " b"]));
  });
});

describe("diceCoefficient", () => {
  it("returns 1.0 for identical strings", () => {
    expect(diceCoefficient("hello", "hello")).toBe(1.0);
  });

  it("returns 0 for completely different strings", () => {
    const score = diceCoefficient("abc", "xyz");
    expect(score).toBe(0);
  });

  it("returns a score between 0 and 1 for partial overlap", () => {
    const score = diceCoefficient("extract commitments", "extract decisions");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("returns 0 for two empty strings", () => {
    expect(diceCoefficient("", "")).toBe(0);
  });
});

describe("bestTriggerMatch", () => {
  const triggers = [
    "extract commitments from this meeting",
    "what did people commit to",
    "pull action items and owners",
  ];

  it("returns 1.0 for exact substring match", () => {
    const score = bestTriggerMatch(
      "please extract commitments from this meeting transcript",
      triggers,
    );
    expect(score).toBe(1.0);
  });

  it("returns a moderate score for fuzzy match", () => {
    const score = bestTriggerMatch("extracting commitments", triggers);
    expect(score).toBeGreaterThan(0);
  });

  it("returns a low score for unrelated message", () => {
    const score = bestTriggerMatch("hello world", triggers);
    expect(score).toBeLessThan(0.3);
  });
});

describe("keywordOverlap", () => {
  it("returns 1.0 when all keywords match", () => {
    const score = keywordOverlap(["risk", "meet", "transcript"], ["risk", "meet"]);
    expect(score).toBe(1.0);
  });

  it("returns 0 when no keywords match", () => {
    const score = keywordOverlap(["hello", "world"], ["risk", "meet"]);
    expect(score).toBe(0);
  });

  it("returns partial overlap ratio", () => {
    const score = keywordOverlap(["risk", "world"], ["risk", "meet"]);
    expect(score).toBe(0.5);
  });

  it("returns 0 for empty skill keywords", () => {
    expect(keywordOverlap(["risk"], [])).toBe(0);
  });
});

describe("antiKeywordPenalty", () => {
  it("returns 1.0 when no anti-keywords match", () => {
    expect(antiKeywordPenalty(["risk", "meet"], ["interview", "candidate"])).toBe(1.0);
  });

  it("returns 0.0 when all anti-keywords match", () => {
    expect(antiKeywordPenalty(["interview"], ["interview"])).toBe(0.0);
  });

  it("returns proportional penalty for partial matches", () => {
    const score = antiKeywordPenalty(
      ["interview", "risk", "meet"],
      ["interview", "candidate", "rubric", "hire"],
    );
    // 1 of 4 anti-keywords matched → 1 - 1/4 = 0.75
    expect(score).toBe(0.75);
  });

  it("scales down as more anti-keywords match", () => {
    const score1 = antiKeywordPenalty(["a"], ["a", "b", "c", "d"]);
    const score2 = antiKeywordPenalty(["a", "b"], ["a", "b", "c", "d"]);
    expect(score1).toBeGreaterThan(score2);
    expect(score1).toBe(0.75);
    expect(score2).toBe(0.5);
  });

  it("returns 1.0 for empty anti-keywords", () => {
    expect(antiKeywordPenalty(["risk"], [])).toBe(1.0);
  });
});

describe("signalPhraseDensity", () => {
  it("returns 0 for empty signal phrases", () => {
    expect(signalPhraseDensity("some text here", [])).toBe(0);
  });

  it("returns 0 when no phrases match", () => {
    const score = signalPhraseDensity(
      "the weather is nice today",
      ["blocked on", "waiting for", "stalling"],
    );
    expect(score).toBe(0);
  });

  it("returns positive score when phrases match", () => {
    const score = signalPhraseDensity(
      "I'll follow up on this by Friday and let me reach out to the team",
      ["i'll", "follow up", "by friday", "let me", "reach out"],
    );
    expect(score).toBeGreaterThan(0.5);
  });

  it("returns 1.0 when all phrases match", () => {
    const score = signalPhraseDensity(
      "i'll follow up by friday",
      ["i'll", "follow up", "by friday"],
    );
    expect(score).toBe(1.0);
  });

  it("is case-insensitive", () => {
    const score = signalPhraseDensity(
      "I'LL FOLLOW UP on this",
      ["i'll", "follow up"],
    );
    expect(score).toBe(1.0);
  });

  it("produces meaningful scores for realistic transcript snippets", () => {
    const transcript = `
      So I think we should probably follow up on the budget issue.
      I'll reach out to Peter and co to get traction on this.
      Let me write up a few scenarios for the demo. I need to figure out
      who is in charge of memory. We should schedule a meeting next week.
    `;
    const commitmentPhrases = [
      "i'll", "let me", "follow up", "reach out", "write up",
      "schedule a", "i need to", "we should",
    ];
    const score = signalPhraseDensity(transcript, commitmentPhrases);
    expect(score).toBeGreaterThan(0.7);
  });
});
