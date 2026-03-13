import type { RunResult, StakeholderAnalysisOutput } from "../../src/skills/stakeholder-analysis/types.js";

export interface CaseExpect {
  min_stakeholders: number;
  min_risks: number;
  min_engagement_steps: number;
  min_citations: number;
  expected_mode: "transcript_only" | "transcript_plus_context";
  known_stakeholder_names?: string[];
}

export interface AssertionResult {
  name: string;
  passed: boolean;
  detail: string;
}

function ok(name: string, detail: string): AssertionResult {
  return { name, passed: true, detail };
}

function fail(name: string, detail: string): AssertionResult {
  return { name, passed: false, detail };
}

function assertSchemaValid(result: RunResult): AssertionResult {
  const name = "schema_valid";
  if (result.ok) return ok(name, "Pipeline returned ok: true");
  return fail(name, `Pipeline failed at stage "${result.error.stage}": ${result.error.message}`);
}

function assertMinStakeholders(data: StakeholderAnalysisOutput, expect: CaseExpect): AssertionResult {
  const name = "min_stakeholders";
  const count = data.stakeholders.length;
  if (count >= expect.min_stakeholders)
    return ok(name, `${count} >= ${expect.min_stakeholders}`);
  return fail(name, `${count} < ${expect.min_stakeholders}`);
}

function assertStakeholderProfilesComplete(data: StakeholderAnalysisOutput): AssertionResult {
  const name = "stakeholder_profiles_complete";
  const incomplete: string[] = [];
  for (const s of data.stakeholders) {
    const missing: string[] = [];
    if (!s.stance) missing.push("stance");
    if (!s.influence_level) missing.push("influence_level");
    if (!s.evidence || s.evidence.length < 1) missing.push("evidence (>= 1)");
    if (missing.length > 0) incomplete.push(`${s.name}: missing ${missing.join(", ")}`);
  }
  if (incomplete.length === 0)
    return ok(name, `All ${data.stakeholders.length} stakeholders have complete profiles`);
  return fail(name, incomplete.join("; "));
}

function assertMinRisks(data: StakeholderAnalysisOutput, expect: CaseExpect): AssertionResult {
  const name = "min_risks";
  const count = data.risks.length;
  if (count < expect.min_risks)
    return fail(name, `${count} < ${expect.min_risks}`);
  const missingFields: string[] = [];
  for (const r of data.risks) {
    if (r.severity == null) missingFields.push(`${r.id}: missing severity`);
    if (r.likelihood == null) missingFields.push(`${r.id}: missing likelihood`);
  }
  if (missingFields.length > 0)
    return fail(name, `Count OK (${count}) but fields missing: ${missingFields.join("; ")}`);
  return ok(name, `${count} >= ${expect.min_risks}, all have severity and likelihood`);
}

function assertMinEngagementSteps(data: StakeholderAnalysisOutput, expect: CaseExpect): AssertionResult {
  const name = "min_engagement_steps";
  const count = data.engagement_plan.length;
  if (count >= expect.min_engagement_steps)
    return ok(name, `${count} >= ${expect.min_engagement_steps}`);
  return fail(name, `${count} < ${expect.min_engagement_steps}`);
}

function assertActionsAccountable(data: StakeholderAnalysisOutput): AssertionResult {
  const name = "actions_accountable";
  const problems: string[] = [];
  for (let i = 0; i < data.next_7_day_actions.length; i++) {
    const a = data.next_7_day_actions[i];
    const missing: string[] = [];
    if (!a.owner || a.owner.trim().length === 0) missing.push("owner");
    if (!a.due || a.due.trim().length === 0) missing.push("due");
    if (!a.proof_artifact || a.proof_artifact.trim().length === 0) missing.push("proof_artifact");
    if (missing.length > 0) problems.push(`action[${i}]: missing ${missing.join(", ")}`);
  }
  if (problems.length === 0)
    return ok(name, `All ${data.next_7_day_actions.length} actions have owner, due, proof_artifact`);
  return fail(name, problems.join("; "));
}

function assertMinCitations(data: StakeholderAnalysisOutput, expect: CaseExpect): AssertionResult {
  const name = "min_citations";
  const count = data.citations.length;
  if (count >= expect.min_citations)
    return ok(name, `${count} >= ${expect.min_citations}`);
  return fail(name, `${count} < ${expect.min_citations}`);
}

function assertRecommendationValid(data: StakeholderAnalysisOutput): AssertionResult {
  const name = "recommendation_valid";
  if (!data.recommended_path) return ok(name, "No recommended_path present (optional field)");
  const status = data.recommended_path.status;
  if (status === "actionable" || status === "insufficient_information")
    return ok(name, `recommended_path.status = "${status}"`);
  return fail(name, `Invalid status: "${status}"`);
}

function assertNoHallucinatedStakeholders(data: StakeholderAnalysisOutput, expect: CaseExpect): AssertionResult {
  const name = "no_hallucinated_stakeholders";
  if (!expect.known_stakeholder_names)
    return ok(name, "No known_stakeholder_names in expect — skipped");
  const allowed = new Set(expect.known_stakeholder_names);
  const hallucinated = data.stakeholders
    .filter((s) => !allowed.has(s.name))
    .map((s) => s.name);
  if (hallucinated.length === 0)
    return ok(name, `All ${data.stakeholders.length} stakeholder names are in the known list`);
  return fail(name, `Hallucinated names: ${hallucinated.join(", ")}`);
}

function assertMetadataModeCorrect(data: StakeholderAnalysisOutput, expect: CaseExpect): AssertionResult {
  const name = "metadata_mode_correct";
  if (data.metadata.mode_used === expect.expected_mode)
    return ok(name, `mode_used = "${data.metadata.mode_used}"`);
  return fail(name, `Expected "${expect.expected_mode}", got "${data.metadata.mode_used}"`);
}

/**
 * Run all 10 assertions against a pipeline result.
 * If the pipeline failed (ok: false), only schema_valid runs — the rest
 * are auto-failed because there's no data to inspect.
 */
export function runAssertions(result: RunResult, expect: CaseExpect): AssertionResult[] {
  const results: AssertionResult[] = [];

  results.push(assertSchemaValid(result));

  if (!result.ok) {
    const names = [
      "min_stakeholders", "stakeholder_profiles_complete", "min_risks",
      "min_engagement_steps", "actions_accountable", "min_citations",
      "recommendation_valid", "no_hallucinated_stakeholders", "metadata_mode_correct",
    ];
    for (const n of names) {
      results.push(fail(n, "Skipped — pipeline returned ok: false"));
    }
    return results;
  }

  const data = result.data;
  results.push(assertMinStakeholders(data, expect));
  results.push(assertStakeholderProfilesComplete(data));
  results.push(assertMinRisks(data, expect));
  results.push(assertMinEngagementSteps(data, expect));
  results.push(assertActionsAccountable(data));
  results.push(assertMinCitations(data, expect));
  results.push(assertRecommendationValid(data));
  results.push(assertNoHallucinatedStakeholders(data, expect));
  results.push(assertMetadataModeCorrect(data, expect));

  return results;
}
