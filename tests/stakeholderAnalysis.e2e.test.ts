import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runStakeholderAnalysis } from "../src/skills/stakeholder-analysis/index.js";
import { runAssertions, type CaseExpect } from "../evals/stakeholder-analysis/assertions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const casesDir = resolve(__dirname, "../evals/stakeholder-analysis/cases");

interface CaseFile {
  id: string;
  description: string;
  input: unknown;
  model_response: unknown;
  expect: CaseExpect;
}

function loadCases(): CaseFile[] {
  return readdirSync(casesDir)
    .filter((f) => f.endsWith(".case.json"))
    .map((f) => JSON.parse(readFileSync(join(casesDir, f), "utf-8")) as CaseFile);
}

describe("stakeholder-analysis e2e eval", () => {
  const cases = loadCases();

  for (const c of cases) {
    describe(`case: ${c.id}`, () => {
      it("passes all assertions", async () => {
        const llmJson = JSON.stringify(c.model_response);
        const result = await runStakeholderAnalysis(c.input, llmJson);
        const assertions = runAssertions(result, c.expect);

        const failures = assertions.filter((a) => !a.passed);
        if (failures.length > 0) {
          const summary = failures.map((f) => `  ${f.name}: ${f.detail}`).join("\n");
          expect.soft(failures.length, `Failed assertions:\n${summary}`).toBe(0);
        }

        expect(assertions.every((a) => a.passed)).toBe(true);
      });
    });
  }

  describe("negative tests", () => {
    it("returns json_parse error for malformed JSON response", async () => {
      const validInput = { transcript: "Speaker A: This is a valid transcript with more than eighty characters to satisfy the minimum length requirement for the schema validation." };
      const result = await runStakeholderAnalysis(validInput, "not valid json {{{{");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.stage).toBe("json_parse");
      }
    });

    it("returns input_validation error for missing transcript", async () => {
      const result = await runStakeholderAnalysis({}, '{"stakeholders":[]}');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.stage).toBe("input_validation");
      }
    });

    it("normalizes invalid enum values in model response without crashing", async () => {
      const validInput = { transcript: "Speaker A: This is a valid transcript with more than eighty characters to satisfy the minimum length requirement for the schema validation." };
      const modelResponse = {
        executive_summary: "Test summary",
        decision_surface: "Test decision",
        stakeholders: [
          {
            name: "Test Person",
            role: "Test Role",
            influence_level: "VERY_HIGH",
            stance: "LOVES_IT",
            evidence: ["Direct quote from test transcript"],
            goals: ["Goal A"],
            concerns: ["Concern A"],
            hidden_incentives_or_constraints: ["Hidden A"],
            alignment_score: 50,
            change_readiness: "medium"
          }
        ],
        power_interest_map: [
          { name: "Test Person", power: 3, interest: 3, quadrant: "manage_closely" }
        ],
        coalition_dynamics: {
          likely_allies: ["Test Person"],
          likely_blockers: [],
          swing_stakeholders: [],
          relationship_risks: []
        },
        risks: [
          {
            id: "R-001",
            title: "Test risk",
            severity: 3,
            likelihood: 3,
            owner_recommendation: "Test Person",
            early_signals: ["Signal A"],
            mitigation: "Mitigate A"
          }
        ],
        engagement_plan: [
          {
            stakeholder: "Test Person",
            objective: "Objective A",
            message_frame: "Frame A",
            ask: "Ask A",
            channel: "1:1",
            timing: "Tomorrow",
            owner: "Someone",
            success_signal: "Signal A"
          }
        ],
        next_7_day_actions: [
          {
            action: "Action A",
            owner: "Test Person",
            due: "Monday",
            proof_artifact: "Email confirmation"
          }
        ],
        open_questions: ["Question A"],
        citations: [
          {
            quote: "Direct quote from test transcript",
            speaker: "Speaker A",
            approximate_location: "opening"
          }
        ],
        metadata: {
          mode_used: "transcript_only",
          generated_at: "2026-03-12T10:00:00Z"
        }
      };

      const result = await runStakeholderAnalysis(validInput, JSON.stringify(modelResponse));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const s = result.data.stakeholders[0];
        expect(["low", "medium", "high", "critical"]).toContain(s.influence_level);
        expect(["supportive", "neutral", "skeptical", "opposed", "unknown"]).toContain(s.stance);
      }
    });
  });
});
