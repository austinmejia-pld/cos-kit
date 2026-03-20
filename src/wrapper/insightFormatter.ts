type Obj = Record<string, unknown>;

function str(data: unknown, key: string, fallback = ""): string {
  if (!data || typeof data !== "object") return fallback;
  const val = (data as Obj)[key];
  return typeof val === "string" && val.length > 0 ? val : fallback;
}

function num(data: unknown, key: string, fallback = 0): number {
  if (!data || typeof data !== "object") return fallback;
  const val = (data as Obj)[key];
  return typeof val === "number" && !Number.isNaN(val) ? val : fallback;
}

function arr(data: unknown, key: string): unknown[] {
  if (!data || typeof data !== "object") return [];
  const val = (data as Obj)[key];
  return Array.isArray(val) ? val : [];
}

function field(data: unknown, key: string): unknown {
  if (!data || typeof data !== "object") return undefined;
  return (data as Obj)[key];
}

function bullet(text: string): string {
  return `- ${text}`;
}

function section(title: string, items: string[]): string {
  if (items.length === 0) return "";
  return `### ${title}\n${items.join("\n")}`;
}

// ── Dispatch ────────────────────────────────────────────────────────

const FORMATTERS: Record<string, (data: unknown) => string> = {
  "execution-friction-xray": formatExecutionFrictionXrayInsight,
  "commitment-extractor": formatCommitmentExtractorInsight,
  "stakeholder-analysis": formatStakeholderAnalysisInsight,
  "decision-quality-audit": formatDecisionQualityAuditInsight,
  "meeting-risk-analysis": formatMeetingRiskAnalysisInsight,
  redteam: formatRedteamInsight,
  "interview-analysis": formatInterviewAnalysisInsight,
  "effective-communication": formatEffectiveCommunicationInsight,
};

export function formatInsight(skillName: string, data: unknown): string {
  const formatter = FORMATTERS[skillName];
  if (!formatter) {
    return `No formatter available for skill: ${skillName}`;
  }
  try {
    return formatter(data);
  } catch {
    return `Failed to format ${skillName} output. Use --raw to see the full JSON.`;
  }
}

// ── Execution Friction X-Ray ────────────────────────────────────────

function formatExecutionFrictionXrayInsight(data: unknown): string {
  const lines: string[] = [];

  const score = num(data, "friction_score");
  const hotspots = arr(data, "friction_hotspots");
  const risks = arr(data, "critical_path_risks");

  lines.push("## Execution Friction X-Ray");
  lines.push("");
  lines.push(
    `**Friction Score: ${score}/100** — ${hotspots.length} hotspot${hotspots.length !== 1 ? "s" : ""}, ${risks.length} critical-path risk${risks.length !== 1 ? "s" : ""}`,
  );

  const sorted = [...hotspots].sort(
    (a, b) => num(b, "severity") - num(a, "severity"),
  );
  const topItems = sorted
    .slice(0, 3)
    .map((h) =>
      bullet(
        `**${str(h, "title")}** (${str(h, "category")}, severity ${num(h, "severity")}/5) — ${str(h, "blast_radius")} blast radius`,
      ),
    );
  if (topItems.length > 0) {
    lines.push("");
    lines.push(section("Top Insights", topItems));
  }

  const killPlan = arr(data, "next_7_day_friction_kill_plan");
  const actions = killPlan
    .slice(0, 3)
    .map((a) =>
      bullet(
        `${str(a, "action")} → **${str(a, "owner")}** (due: ${str(a, "due")})`,
      ),
    );
  if (actions.length > 0) {
    lines.push("");
    lines.push(section("Next Actions", actions));
  }

  const hlm = field(data, "single_highest_leverage_move");
  if (hlm) {
    const why = str(hlm, "why");
    lines.push("");
    lines.push("### Highest Leverage Move");
    lines.push(
      `→ **${str(hlm, "move")}** — ${why.slice(0, 200)}${why.length > 200 ? "…" : ""}`,
    );
    lines.push(
      `  Owner: ${str(hlm, "owner")} | Deadline: ${str(hlm, "deadline")}`,
    );
  }

  return lines.join("\n");
}

// ── Commitment Extractor ────────────────────────────────────────────

function formatCommitmentExtractorInsight(data: unknown): string {
  const lines: string[] = [];

  const commitments = arr(data, "commitments");
  const rollup = arr(data, "owner_rollup");
  const unassigned = arr(data, "unassigned_actions");
  const ownerCount = rollup.length;
  const criticalCount = commitments.filter(
    (c) => str(c, "priority") === "critical",
  ).length;

  lines.push("## Commitment Extraction");
  lines.push("");
  lines.push(
    `**${commitments.length} commitment${commitments.length !== 1 ? "s" : ""}** across ${ownerCount} owner${ownerCount !== 1 ? "s" : ""}${criticalCount > 0 ? ` — ${criticalCount} critical` : ""}${unassigned.length > 0 ? `, ${unassigned.length} unassigned` : ""}`,
  );

  const insights: string[] = [];
  const topOwners = [...rollup]
    .sort((a, b) => num(b, "count") - num(a, "count"))
    .slice(0, 2);
  for (const o of topOwners) {
    const cc = num(o, "critical_count");
    insights.push(
      bullet(
        `**${str(o, "owner")}**: ${num(o, "count")} commitment${num(o, "count") !== 1 ? "s" : ""}${cc > 0 ? ` (${cc} critical)` : ""}`,
      ),
    );
  }
  const missing = arr(data, "missing_fields");
  if (missing.length > 0) {
    insights.push(
      bullet(
        `${missing.length} commitment${missing.length !== 1 ? "s" : ""} with missing fields need follow-up`,
      ),
    );
  }
  if (insights.length > 0) {
    lines.push("");
    lines.push(section("Top Insights", insights));
  }

  const priorityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sorted = [...commitments].sort(
    (a, b) =>
      (priorityOrder[str(a, "priority")] ?? 4) -
      (priorityOrder[str(b, "priority")] ?? 4),
  );
  const actionItems = sorted.slice(0, 3).map((c) => {
    const due =
      str(c, "due_date_normalized") || str(c, "due_date_raw") || "TBD";
    return bullet(
      `${str(c, "id")}: ${str(c, "commitment_text").slice(0, 80)} → **${str(c, "owner")}** (due: ${due})`,
    );
  });
  if (actionItems.length > 0) {
    lines.push("");
    lines.push(section("Next Actions", actionItems));
  }

  if (unassigned.length > 0) {
    lines.push("");
    lines.push("### Highest Leverage Move");
    lines.push(
      `→ **Assign owner for:** ${String(unassigned[0]).slice(0, 120)}`,
    );
  } else if (missing.length > 0) {
    const first = missing[0];
    lines.push("");
    lines.push("### Highest Leverage Move");
    lines.push(
      `→ **Resolve missing fields for ${str(first, "commitment_id")}:** ${str(first, "suggested_followup_question")}`,
    );
  }

  return lines.join("\n");
}

// ── Stakeholder Analysis ────────────────────────────────────────────

function formatStakeholderAnalysisInsight(data: unknown): string {
  const lines: string[] = [];

  const stakeholders = arr(data, "stakeholders");
  const risks = arr(data, "risks");
  const dynamics = field(data, "coalition_dynamics");
  const blockers = dynamics ? arr(dynamics, "likely_blockers") : [];

  lines.push("## Stakeholder Analysis");
  lines.push("");
  lines.push(
    `**${stakeholders.length} stakeholder${stakeholders.length !== 1 ? "s" : ""} mapped** — ${risks.length} risk${risks.length !== 1 ? "s" : ""}, ${blockers.length} likely blocker${blockers.length !== 1 ? "s" : ""}`,
  );

  const influenceOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sortedStakeholders = [...stakeholders].sort(
    (a, b) =>
      (influenceOrder[str(a, "influence_level")] ?? 4) -
      (influenceOrder[str(b, "influence_level")] ?? 4),
  );

  const insights = sortedStakeholders
    .slice(0, 3)
    .map((s) =>
      bullet(
        `**${str(s, "name")}** (${str(s, "role")}) — ${str(s, "stance")}, influence: ${str(s, "influence_level")}, alignment: ${num(s, "alignment_score")}/100`,
      ),
    );
  if (insights.length > 0) {
    lines.push("");
    lines.push(section("Top Insights", insights));
  }

  const actions7 = arr(data, "next_7_day_actions");
  const actionLines = actions7
    .slice(0, 3)
    .map((a) =>
      bullet(
        `${str(a, "action")} → **${str(a, "owner")}** (due: ${str(a, "due")})`,
      ),
    );
  if (actionLines.length > 0) {
    lines.push("");
    lines.push(section("Next Actions", actionLines));
  }

  const path = field(data, "recommended_path");
  if (path && str(path, "status") === "actionable") {
    const leverage = arr(path, "leverage");
    if (leverage.length > 0) {
      const first = leverage[0];
      lines.push("");
      lines.push("### Highest Leverage Move");
      lines.push(
        `→ **Leverage ${str(first, "stakeholder")}** — ${str(first, "why")}`,
      );
    }
  }

  return lines.join("\n");
}

// ── Decision Quality Audit ──────────────────────────────────────────

function formatDecisionQualityAuditInsight(data: unknown): string {
  const lines: string[] = [];

  const score = num(data, "decision_quality_score");
  const status = str(data, "decision_status", "unknown");
  const gaps = arr(data, "gaps");

  lines.push("## Decision Quality Audit");
  lines.push("");
  lines.push(
    `**Decision Quality: ${score}/100** — status: ${status}, ${gaps.length} gap${gaps.length !== 1 ? "s" : ""} identified`,
  );

  const breakdown = field(data, "score_breakdown") as Obj | undefined;
  if (breakdown) {
    const dims = [
      ["Clarity", num(breakdown, "clarity_of_decision")] as const,
      ["Evidence", num(breakdown, "evidence_quality")] as const,
      ["Alternatives", num(breakdown, "alternatives_considered")] as const,
      ["Risk", num(breakdown, "risk_assessment_quality")] as const,
      ["Accountability", num(breakdown, "ownership_and_accountability")] as const,
      ["Checkpoints", num(breakdown, "reversibility_and_checkpoints")] as const,
    ];
    const sorted = [...dims].sort((a, b) => a[1] - b[1]);

    const insights: string[] = [];
    insights.push(
      bullet(`Weakest: **${sorted[0][0]}** (${sorted[0][1]}/100)`),
    );
    insights.push(
      bullet(
        `Strongest: **${sorted[sorted.length - 1][0]}** (${sorted[sorted.length - 1][1]}/100)`,
      ),
    );
    if (gaps.length > 0) {
      insights.push(
        bullet(
          `Top gap: **${str(gaps[0], "gap")}** (impact: ${str(gaps[0], "impact_level")})`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Top Insights", insights));
  }

  const upgrades = arr(data, "decision_hygiene_upgrades_next_meeting");
  const actions = upgrades
    .slice(0, 3)
    .map((u) => bullet(String(u).slice(0, 120)));
  if (actions.length > 0) {
    lines.push("");
    lines.push(section("Next Actions", actions));
  }

  const upgrade = field(data, "single_most_important_upgrade");
  if (upgrade) {
    const why = str(upgrade, "why");
    lines.push("");
    lines.push("### Highest Leverage Move");
    lines.push(
      `→ **${str(upgrade, "upgrade")}** — ${why.slice(0, 200)}${why.length > 200 ? "…" : ""}`,
    );
    lines.push(
      `  Owner: ${str(upgrade, "owner")} | Deadline: ${str(upgrade, "deadline")}`,
    );
  }

  return lines.join("\n");
}

// ── Meeting Risk Analysis ───────────────────────────────────────────

function formatMeetingRiskAnalysisInsight(data: unknown): string {
  const lines: string[] = [];

  const riskLevel = str(data, "overall_risk_level", "unknown");
  const risks = arr(data, "risks");
  const tensions = arr(data, "unresolved_tensions");

  lines.push("## Meeting Risk Analysis");
  lines.push("");
  lines.push(
    `**Overall Risk: ${riskLevel}** — ${risks.length} risk${risks.length !== 1 ? "s" : ""}, ${tensions.length} unresolved tension${tensions.length !== 1 ? "s" : ""}`,
  );

  const sorted = [...risks].sort(
    (a, b) => num(b, "severity") - num(a, "severity"),
  );
  const insights = sorted
    .slice(0, 3)
    .map((r) =>
      bullet(
        `**${str(r, "title")}** (severity ${num(r, "severity")}/5, likelihood ${num(r, "likelihood")}/5)`,
      ),
    );
  if (insights.length > 0) {
    lines.push("");
    lines.push(section("Top Insights", insights));
  }

  const actions = arr(data, "recommended_actions");
  const actionLines = actions
    .slice(0, 3)
    .map((a) =>
      bullet(
        `${str(a, "action")} → **${str(a, "owner")}** (due: ${str(a, "due_date")})`,
      ),
    );
  if (actionLines.length > 0) {
    lines.push("");
    lines.push(section("Next Actions", actionLines));
  }

  if (actions.length > 0) {
    const top = actions[0];
    lines.push("");
    lines.push("### Highest Leverage Move");
    lines.push(
      `→ **${str(top, "action")}** — Owner: ${str(top, "owner")} | Due: ${str(top, "due_date")}`,
    );
  }

  return lines.join("\n");
}

// ── Red Team ────────────────────────────────────────────────────────

function formatRedteamInsight(data: unknown): string {
  const lines: string[] = [];

  const riskLevel = str(data, "overall_risk_level", "unknown");
  const failures = arr(data, "failure_modes");
  const rec = field(data, "decision_recommendation");

  lines.push("## Red Team Analysis");
  lines.push("");
  lines.push(
    `**Risk Level: ${riskLevel}** — ${failures.length} failure mode${failures.length !== 1 ? "s" : ""} identified`,
  );
  if (rec) {
    lines.push(`**Recommendation: ${str(rec, "recommendation")}**`);
  }

  const sorted = [...failures].sort(
    (a, b) => num(b, "severity") - num(a, "severity"),
  );
  const insights = sorted.slice(0, 3).map((f) => {
    const why = str(f, "why_it_fails");
    return bullet(
      `**${str(f, "title")}** (severity ${num(f, "severity")}/5, likelihood ${num(f, "likelihood")}/5) — ${why.slice(0, 100)}${why.length > 100 ? "…" : ""}`,
    );
  });
  if (insights.length > 0) {
    lines.push("");
    lines.push(section("Top Insights", insights));
  }

  const commitments = arr(data, "commitments_extracted");
  const actionItems = commitments
    .slice(0, 3)
    .map((c) =>
      bullet(
        `${str(c, "commitment")} → **${str(c, "owner")}** (due: ${str(c, "due_date_or_window")})`,
      ),
    );
  if (actionItems.length > 0) {
    lines.push("");
    lines.push(section("Next Actions", actionItems));
  }

  if (rec) {
    lines.push("");
    lines.push("### Highest Leverage Move");
    const rationale = str(rec, "rationale");
    lines.push(
      `→ **${str(rec, "recommendation")}** — ${rationale.slice(0, 200)}${rationale.length > 200 ? "…" : ""}`,
    );
    const checks = arr(rec, "required_next_checks");
    if (checks.length > 0) {
      lines.push(`  Next check: ${String(checks[0])}`);
    }
  }

  return lines.join("\n");
}

// ── Interview Analysis ──────────────────────────────────────────────

function formatInterviewAnalysisInsight(data: unknown): string {
  const lines: string[] = [];

  const recommendation = str(data, "recommendation", "unknown");
  const confidence = str(data, "confidence", "unknown");
  const dimensions = arr(data, "dimension_scores");

  lines.push("## Interview Analysis");
  lines.push("");
  lines.push(
    `**Recommendation: ${recommendation}** (confidence: ${confidence}) — ${dimensions.length} dimension${dimensions.length !== 1 ? "s" : ""} scored`,
  );

  const insights: string[] = [];
  const strengths = arr(data, "strengths");
  if (strengths.length > 0) {
    insights.push(
      bullet(`Key strength: ${String(strengths[0]).slice(0, 120)}`),
    );
  }
  const concerns = arr(data, "concerns");
  if (concerns.length > 0) {
    insights.push(
      bullet(`Key concern: ${String(concerns[0]).slice(0, 120)}`),
    );
  }
  const riskFlags = arr(data, "risk_flags");
  if (riskFlags.length > 0) {
    insights.push(
      bullet(
        `${riskFlags.length} risk flag${riskFlags.length !== 1 ? "s" : ""} raised`,
      ),
    );
  }
  if (insights.length > 0) {
    lines.push("");
    lines.push(section("Top Insights", insights));
  }

  const followUps = arr(data, "follow_up_questions");
  const followUpLines = followUps
    .slice(0, 3)
    .map((q) => bullet(String(q).slice(0, 120)));
  if (followUpLines.length > 0) {
    lines.push("");
    lines.push(section("Follow-Up Questions", followUpLines));
  }

  if (concerns.length > 0) {
    lines.push("");
    lines.push("### Highest Leverage Move");
    lines.push(
      `→ **Address top concern:** ${String(concerns[0]).slice(0, 200)}`,
    );
  }

  return lines.join("\n");
}

// ── Effective Communication ─────────────────────────────────────────

function formatEffectiveCommunicationInsight(data: unknown): string {
  const lines: string[] = [];

  const score = num(data, "overall_effectiveness_score");
  const status = str(data, "communication_status", "unknown");
  const improvements = arr(data, "priority_improvements");

  lines.push("## Communication Coaching");
  lines.push("");
  lines.push(
    `**Effectiveness: ${score}/100** — ${status.replace(/_/g, " ")} — ${improvements.length} improvement${improvements.length !== 1 ? "s" : ""} identified`,
  );

  const breakdown = field(data, "score_breakdown") as Obj | undefined;
  if (breakdown) {
    const dims = [
      ["Clarity", num(breakdown, "clarity")] as const,
      ["Brevity", num(breakdown, "brevity")] as const,
      ["Structure", num(breakdown, "structure")] as const,
      ["Audience Alignment", num(breakdown, "audience_alignment")] as const,
      ["Executive Presence", num(breakdown, "executive_presence")] as const,
      ["Action Orientation", num(breakdown, "action_orientation")] as const,
      ["Listening", num(breakdown, "listening_and_responsiveness")] as const,
    ];
    const sorted = [...dims].sort((a, b) => a[1] - b[1]);

    const insights: string[] = [];
    insights.push(
      bullet(`Weakest: **${sorted[0][0]}** (${sorted[0][1]}/100)`),
    );
    insights.push(
      bullet(
        `Strongest: **${sorted[sorted.length - 1][0]}** (${sorted[sorted.length - 1][1]}/100)`,
      ),
    );

    const coachTake = str(data, "coach_take");
    if (coachTake) {
      insights.push(
        bullet(
          `Coach: ${coachTake.slice(0, 150)}${coachTake.length > 150 ? "…" : ""}`,
        ),
      );
    }

    lines.push("");
    lines.push(section("Top Insights", insights));
  }

  const impactOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sortedImprovements = [...improvements].sort(
    (a, b) =>
      (impactOrder[str(a, "impact_level")] ?? 4) -
      (impactOrder[str(b, "impact_level")] ?? 4),
  );
  const actionItems = sortedImprovements.slice(0, 3).map((i) =>
    bullet(
      `**${str(i, "theme")}** (${str(i, "impact_level")}) — ${str(i, "diagnosis").slice(0, 100)}${str(i, "diagnosis").length > 100 ? "…" : ""}`,
    ),
  );
  if (actionItems.length > 0) {
    lines.push("");
    lines.push(section("Priority Improvements", actionItems));
  }

  const oneThing = field(data, "one_thing_to_change_next_meeting");
  if (oneThing) {
    lines.push("");
    lines.push("### One Thing to Change");
    lines.push(
      `→ **${str(oneThing, "change")}** — ${str(oneThing, "why").slice(0, 200)}${str(oneThing, "why").length > 200 ? "…" : ""}`,
    );
    const signal = str(oneThing, "success_signal");
    if (signal) {
      lines.push(`  Success signal: ${signal}`);
    }
  }

  return lines.join("\n");
}
