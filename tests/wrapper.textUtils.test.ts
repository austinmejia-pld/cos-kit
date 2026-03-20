import { describe, it, expect } from "vitest";
import {
  tokenize,
  bigrams,
  diceCoefficient,
  bestTriggerMatch,
  keywordOverlap,
  antiKeywordPenalty,
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

  it("returns 0.0 when anti-keyword matches", () => {
    expect(antiKeywordPenalty(["interview", "risk"], ["interview"])).toBe(0.0);
  });

  it("returns 1.0 for empty anti-keywords", () => {
    expect(antiKeywordPenalty(["risk"], [])).toBe(1.0);
  });
});
