import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { formatInsight } from "../src/wrapper/insightFormatter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(filename: string): unknown {
  return JSON.parse(
    readFileSync(resolve(__dirname, "..", "fixtures", filename), "utf-8"),
  );
}

describe("formatInsight dispatch", () => {
  it("returns error for unknown skill", () => {
    const result = formatInsight("nonexistent-skill", {});
    expect(result).toContain("No formatter available");
  });

  it("handles formatter exception gracefully", () => {
    const result = formatInsight("execution-friction-xray", "not an object");
    expect(result).toContain("## Execution Friction X-Ray");
  });
});

describe("formatExecutionFrictionXrayInsight", () => {
  const fixture = loadFixture("execution-friction-xray.output.example.json");

  it("produces markdown with all required sections", () => {
    const result = formatInsight("execution-friction-xray", fixture);
    expect(result).toContain("## Execution Friction X-Ray");
    expect(result).toContain("Friction Score: 72/100");
    expect(result).toContain("### Top Insights");
    expect(result).toContain("### Next Actions");
    expect(result).toContain("### Highest Leverage Move");
  });

  it("does not contain raw JSON keys", () => {
    const result = formatInsight("execution-friction-xray", fixture);
    expect(result).not.toContain('"friction_hotspots"');
    expect(result).not.toContain('"executive_summary"');
    expect(result).not.toContain('"blast_radius":');
  });

  it("includes hotspot titles", () => {
    const result = formatInsight("execution-friction-xray", fixture);
    expect(result).toContain(
      "No owner assigned for Japan legal and compliance review",
    );
  });

  it("includes kill plan actions with owners", () => {
    const result = formatInsight("execution-friction-xray", fixture);
    expect(result).toContain("Ravi Patel");
    expect(result).toContain("Diana Osei");
  });

  it("degrades gracefully with empty data", () => {
    const result = formatInsight("execution-friction-xray", {});
    expect(result).toContain("## Execution Friction X-Ray");
    expect(result).toContain("Friction Score: 0/100");
    expect(result).toContain("0 hotspots");
  });

  it("degrades gracefully with null", () => {
    const result = formatInsight("execution-friction-xray", null);
    expect(result).toContain("## Execution Friction X-Ray");
  });
});

describe("formatCommitmentExtractorInsight", () => {
  const fixture = loadFixture("commitment-extractor.output.example.json");

  it("produces markdown with all required sections", () => {
    const result = formatInsight("commitment-extractor", fixture);
    expect(result).toContain("## Commitment Extraction");
    expect(result).toContain("5 commitments");
    expect(result).toContain("3 owners");
    expect(result).toContain("### Top Insights");
    expect(result).toContain("### Next Actions");
  });

  it("shows critical count", () => {
    const result = formatInsight("commitment-extractor", fixture);
    expect(result).toContain("1 critical");
  });

  it("shows unassigned actions in highest leverage move", () => {
    const result = formatInsight("commitment-extractor", fixture);
    expect(result).toContain("### Highest Leverage Move");
    expect(result).toContain("Assign owner for:");
  });

  it("does not contain raw JSON keys", () => {
    const result = formatInsight("commitment-extractor", fixture);
    expect(result).not.toContain('"commitments"');
    expect(result).not.toContain('"owner_rollup"');
  });

  it("degrades with empty commitments", () => {
    const result = formatInsight("commitment-extractor", {
      summary: "test",
      commitments: [],
    });
    expect(result).toContain("0 commitments");
  });
});

describe("formatStakeholderAnalysisInsight", () => {
  const fixture = loadFixture("stakeholder-analysis.output.example.json");

  it("produces markdown with all required sections", () => {
    const result = formatInsight("stakeholder-analysis", fixture);
    expect(result).toContain("## Stakeholder Analysis");
    expect(result).toContain("4 stakeholders mapped");
    expect(result).toContain("### Top Insights");
    expect(result).toContain("### Next Actions");
    expect(result).toContain("### Highest Leverage Move");
  });

  it("includes stakeholder names sorted by influence", () => {
    const result = formatInsight("stakeholder-analysis", fixture);
    const raviIdx = result.indexOf("Ravi Patel");
    expect(raviIdx).toBeGreaterThan(-1);
  });

  it("does not contain raw JSON keys", () => {
    const result = formatInsight("stakeholder-analysis", fixture);
    expect(result).not.toContain('"stakeholders"');
    expect(result).not.toContain('"coalition_dynamics"');
  });
});

describe("formatDecisionQualityAuditInsight", () => {
  const fixture = loadFixture("decision-quality-audit.output.example.json");

  it("produces markdown with all required sections", () => {
    const result = formatInsight("decision-quality-audit", fixture);
    expect(result).toContain("## Decision Quality Audit");
    expect(result).toContain("Decision Quality: 62/100");
    expect(result).toContain("### Top Insights");
    expect(result).toContain("### Next Actions");
    expect(result).toContain("### Highest Leverage Move");
  });

  it("identifies weakest and strongest dimensions", () => {
    const result = formatInsight("decision-quality-audit", fixture);
    expect(result).toContain("Weakest:");
    expect(result).toContain("Strongest:");
  });

  it("does not contain raw JSON keys", () => {
    const result = formatInsight("decision-quality-audit", fixture);
    expect(result).not.toContain('"score_breakdown"');
    expect(result).not.toContain('"decision_quality_score"');
  });
});

describe("graceful degradation", () => {
  const skills = [
    "execution-friction-xray",
    "commitment-extractor",
    "stakeholder-analysis",
    "decision-quality-audit",
    "meeting-risk-analysis",
    "redteam",
    "interview-analysis",
  ];

  it.each(skills)("%s handles empty object without crashing", (skill) => {
    const result = formatInsight(skill, {});
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it.each(skills)("%s handles null without crashing", (skill) => {
    const result = formatInsight(skill, null);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
