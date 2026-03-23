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

function quoteLines(quotes: unknown[]): string[] {
  return quotes.map((q) => `→ "${String(q)}"`);
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

// ── Interview Analysis ──────────────────────────────────────────────

function formatInterviewAnalysisInsight(data: unknown): string {
  const lines: string[] = [];

  const recommendation = str(data, "recommendation", "unknown");
  const confidence = num(data, "confidence");
  const decisionSummary = str(data, "decision_summary");
  const dimensions = arr(data, "dimension_scores");
  const strengths = arr(data, "strengths");
  const concerns = arr(data, "concerns");
  const riskFlags = arr(data, "risk_flags");
  const interviewerFeedback = arr(data, "interviewer_feedback");
  const followUps = arr(data, "follow_up_questions");

  lines.push("## Interview Analysis");
  lines.push("");
  lines.push(
    `**Recommendation: ${recommendation}** | Confidence: ${confidence} | ${dimensions.length} dimension${dimensions.length !== 1 ? "s" : ""} scored`,
  );

  if (decisionSummary) {
    lines.push("");
    lines.push(decisionSummary);
  }

  // Dimension scores — each dimension as its own subsection
  for (const dim of dimensions) {
    const name = str(dim, "dimension");
    const score = num(dim, "score");
    const rationale = str(dim, "rationale");
    const quotes = arr(dim, "evidence_quotes");

    lines.push("");
    lines.push(`### ${name} — ${score}/4`);
    if (rationale) {
      lines.push(rationale);
    }
    if (quotes.length > 0) {
      lines.push("");
      for (const q of quoteLines(quotes)) {
        lines.push(q);
      }
    }
  }

  if (strengths.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Strengths",
        strengths.map((s) => bullet(String(s))),
      ),
    );
  }

  if (concerns.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Concerns",
        concerns.map((c) => bullet(String(c))),
      ),
    );
  }

  if (riskFlags.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Risk Flags",
        riskFlags.map((r) => bullet(String(r))),
      ),
    );
  }

  if (interviewerFeedback.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Interviewer Feedback",
        interviewerFeedback.map((f) => bullet(String(f))),
      ),
    );
  }

  if (followUps.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Follow-Up Questions",
        followUps.map((q) => bullet(String(q))),
      ),
    );
  }

  return lines.join("\n");
}

// ── Execution Friction X-Ray ────────────────────────────────────────

function formatExecutionFrictionXrayInsight(data: unknown): string {
  const lines: string[] = [];

  const execSummary = str(data, "executive_summary");
  const score = num(data, "friction_score");
  const hotspots = arr(data, "friction_hotspots");
  const risks = arr(data, "critical_path_risks");
  const ambiguities = arr(data, "ambiguities_to_resolve");
  const killPlan = arr(data, "next_7_day_friction_kill_plan");
  const hlm = field(data, "single_highest_leverage_move");
  const citations = arr(data, "citations");

  lines.push("## Execution Friction X-Ray");
  lines.push("");
  lines.push(
    `**Friction Score: ${score}/100** — ${hotspots.length} hotspot${hotspots.length !== 1 ? "s" : ""}, ${risks.length} critical-path risk${risks.length !== 1 ? "s" : ""}`,
  );

  if (execSummary) {
    lines.push("");
    lines.push(execSummary);
  }

  // Friction hotspots — full detail per hotspot
  const sorted = [...hotspots].sort(
    (a, b) => num(b, "severity") - num(a, "severity"),
  );
  for (const h of sorted) {
    const title = str(h, "title");
    const category = str(h, "category");
    const severity = num(h, "severity");
    const likelihood = num(h, "likelihood");
    const blastRadius = str(h, "blast_radius");
    const whyDrag = str(h, "why_it_creates_drag");
    const fix = str(h, "recommended_fix");
    const owner = str(h, "owner_recommendation");
    const window = str(h, "target_resolution_window");
    const signals = arr(h, "early_warning_signals");
    const evidence = arr(h, "evidence");

    lines.push("");
    lines.push(
      `### ${title} (${category}, severity ${severity}/5, likelihood ${likelihood}/5, ${blastRadius} blast radius)`,
    );
    if (whyDrag) {
      lines.push(whyDrag);
    }
    if (fix) {
      lines.push(`**Recommended fix:** ${fix}`);
    }
    if (owner || window) {
      lines.push(
        `**Owner:** ${owner || "TBD"} | **Resolve by:** ${window || "TBD"}`,
      );
    }
    if (signals.length > 0) {
      lines.push("**Early warning signals:**");
      for (const s of signals) {
        lines.push(bullet(String(s)));
      }
    }
    if (evidence.length > 0) {
      for (const e of evidence) {
        lines.push(
          `→ "${str(e, "quote")}" — ${str(e, "speaker")}, ${str(e, "approximate_location")}`,
        );
      }
    }
  }

  // Critical path risks
  if (risks.length > 0) {
    const riskItems: string[] = [];
    for (const r of risks) {
      const riskText = str(r, "risk");
      const dep = str(r, "blocking_dependency");
      const owner = str(r, "owner");
      const trigger = str(r, "due_or_trigger");
      const unblock = str(r, "unblock_action");
      riskItems.push(
        bullet(
          `**${riskText}** — blocked by: ${dep} | Owner: ${owner} | Due/trigger: ${trigger} | Unblock: ${unblock}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Critical Path Risks", riskItems));
  }

  // Ambiguities to resolve
  if (ambiguities.length > 0) {
    const ambItems: string[] = [];
    for (const a of ambiguities) {
      const ambiguity = str(a, "ambiguity");
      const why = str(a, "why_it_matters");
      const question = str(a, "proposed_clarifying_question");
      ambItems.push(bullet(`**${ambiguity}** — ${why}`));
      ambItems.push(`  → Clarifying question: ${question}`);
    }
    lines.push("");
    lines.push(section("Ambiguities to Resolve", ambItems));
  }

  // 7-day friction kill plan
  if (killPlan.length > 0) {
    const planItems: string[] = [];
    for (const a of killPlan) {
      const action = str(a, "action");
      const owner = str(a, "owner");
      const due = str(a, "due");
      const proof = str(a, "proof_artifact");
      planItems.push(
        bullet(`${action} → **${owner}** (due: ${due}) | Proof: ${proof}`),
      );
    }
    lines.push("");
    lines.push(section("7-Day Friction Kill Plan", planItems));
  }

  // Highest leverage move
  if (hlm) {
    lines.push("");
    lines.push("### Highest Leverage Move");
    lines.push(`→ **${str(hlm, "move")}** — ${str(hlm, "why")}`);
    lines.push(
      `Owner: ${str(hlm, "owner")} | Deadline: ${str(hlm, "deadline")} | Success signal: ${str(hlm, "success_signal")}`,
    );
  }

  // Citations
  if (citations.length > 0) {
    const citItems: string[] = [];
    for (const c of citations) {
      citItems.push(
        `→ "${str(c, "quote")}" — ${str(c, "speaker")}, ${str(c, "approximate_location")}`,
      );
    }
    lines.push("");
    lines.push(section("Citations", citItems));
  }

  return lines.join("\n");
}

// ── Commitment Extractor ────────────────────────────────────────────

function formatCommitmentExtractorInsight(data: unknown): string {
  const lines: string[] = [];

  const summary = str(data, "summary");
  const commitments = arr(data, "commitments");
  const unassigned = arr(data, "unassigned_actions");
  const missing = arr(data, "missing_fields");
  const rollup = arr(data, "owner_rollup");

  const ownerCount = rollup.length;
  const criticalCount = commitments.filter(
    (c) => str(c, "priority") === "critical",
  ).length;

  lines.push("## Commitment Extraction");
  lines.push("");
  lines.push(
    `**${commitments.length} commitment${commitments.length !== 1 ? "s" : ""}** across ${ownerCount} owner${ownerCount !== 1 ? "s" : ""}${criticalCount > 0 ? ` — ${criticalCount} critical` : ""}${unassigned.length > 0 ? `, ${unassigned.length} unassigned` : ""}`,
  );

  if (summary) {
    lines.push("");
    lines.push(summary);
  }

  // Owner rollup
  if (rollup.length > 0) {
    const rollupItems: string[] = [];
    for (const o of rollup) {
      const cc = num(o, "critical_count");
      rollupItems.push(
        bullet(
          `**${str(o, "owner")}**: ${num(o, "count")} commitment${num(o, "count") !== 1 ? "s" : ""}${cc > 0 ? ` (${cc} critical)` : ""}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Owner Rollup", rollupItems));
  }

  // Individual commitments — full detail
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
  for (const c of sorted) {
    const id = str(c, "id");
    const text = str(c, "commitment_text");
    const type = str(c, "commitment_type");
    const owner = str(c, "owner");
    const ownerConf = str(c, "owner_confidence");
    const dueRaw = str(c, "due_date_raw");
    const dueNorm = str(c, "due_date_normalized");
    const status = str(c, "status");
    const priority = str(c, "priority");
    const proof = str(c, "proof_artifact_expected");
    const deps = arr(c, "dependencies");
    const blockers = arr(c, "blockers");
    const evidence = arr(c, "source_evidence");
    const conf = num(c, "confidence_score");

    const due = dueNorm || dueRaw || "TBD";

    lines.push("");
    lines.push(`### ${id}: ${text}`);
    lines.push(
      `**Type:** ${type} | **Owner:** ${owner} (${ownerConf}) | **Due:** ${due} | **Status:** ${status} | **Priority:** ${priority} | **Confidence:** ${conf}`,
    );
    if (proof) {
      lines.push(`**Proof artifact:** ${proof}`);
    }
    if (deps.length > 0) {
      lines.push(`**Dependencies:** ${deps.map(String).join(", ")}`);
    }
    if (blockers.length > 0) {
      lines.push(`**Blockers:** ${blockers.map(String).join(", ")}`);
    }
    if (evidence.length > 0) {
      for (const e of evidence) {
        lines.push(
          `→ "${str(e, "quote")}" — ${str(e, "speaker")}, ${str(e, "approximate_location")}`,
        );
      }
    }
  }

  // Unassigned actions
  if (unassigned.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Unassigned Actions",
        unassigned.map((a) => bullet(String(a))),
      ),
    );
  }

  // Missing fields
  if (missing.length > 0) {
    const missingItems: string[] = [];
    for (const m of missing) {
      const cId = str(m, "commitment_id");
      const fields = arr(m, "missing").map(String).join(", ");
      const question = str(m, "suggested_followup_question");
      missingItems.push(bullet(`**${cId}** — missing: ${fields}`));
      missingItems.push(`  → ${question}`);
    }
    lines.push("");
    lines.push(section("Missing Fields", missingItems));
  }

  return lines.join("\n");
}

// ── Stakeholder Analysis ────────────────────────────────────────────

function formatStakeholderAnalysisInsight(data: unknown): string {
  const lines: string[] = [];

  const execSummary = str(data, "executive_summary");
  const decisionSurface = str(data, "decision_surface");
  const stakeholders = arr(data, "stakeholders");
  const powerMap = arr(data, "power_interest_map");
  const dynamics = field(data, "coalition_dynamics");
  const risks = arr(data, "risks");
  const engagement = arr(data, "engagement_plan");
  const actions7 = arr(data, "next_7_day_actions");
  const openQs = arr(data, "open_questions");
  const citations = arr(data, "citations");
  const recPath = field(data, "recommended_path");

  const blockers = dynamics ? arr(dynamics, "likely_blockers") : [];

  lines.push("## Stakeholder Analysis");
  lines.push("");
  lines.push(
    `**${stakeholders.length} stakeholder${stakeholders.length !== 1 ? "s" : ""} mapped** — ${risks.length} risk${risks.length !== 1 ? "s" : ""}, ${blockers.length} likely blocker${blockers.length !== 1 ? "s" : ""}`,
  );

  if (execSummary) {
    lines.push("");
    lines.push(execSummary);
  }

  if (decisionSurface) {
    lines.push("");
    lines.push(`**Decision surface:** ${decisionSurface}`);
  }

  // Stakeholder profiles — full detail
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

  for (const s of sortedStakeholders) {
    const name = str(s, "name");
    const role = str(s, "role");
    const influence = str(s, "influence_level");
    const stance = str(s, "stance");
    const alignment = num(s, "alignment_score");
    const readiness = str(s, "change_readiness");
    const goals = arr(s, "goals");
    const sConcerns = arr(s, "concerns");
    const hidden = arr(s, "hidden_incentives_or_constraints");
    const evidence = arr(s, "evidence");

    lines.push("");
    lines.push(
      `### ${name} (${role}) — ${stance}, influence: ${influence}, alignment: ${alignment}/100, change readiness: ${readiness}`,
    );
    if (goals.length > 0) {
      lines.push(`**Goals:** ${goals.map(String).join("; ")}`);
    }
    if (sConcerns.length > 0) {
      lines.push(`**Concerns:** ${sConcerns.map(String).join("; ")}`);
    }
    if (hidden.length > 0) {
      lines.push(
        `**Hidden incentives/constraints:** ${hidden.map(String).join("; ")}`,
      );
    }
    if (evidence.length > 0) {
      for (const q of quoteLines(evidence)) {
        lines.push(q);
      }
    }
  }

  // Power-interest map
  if (powerMap.length > 0) {
    const mapItems: string[] = [];
    for (const p of powerMap) {
      mapItems.push(
        bullet(
          `**${str(p, "name")}** — power: ${num(p, "power")}/5, interest: ${num(p, "interest")}/5, quadrant: ${str(p, "quadrant")}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Power-Interest Map", mapItems));
  }

  // Coalition dynamics
  if (dynamics) {
    lines.push("");
    lines.push("### Coalition Dynamics");
    const allies = arr(dynamics, "likely_allies");
    const dBlockers = arr(dynamics, "likely_blockers");
    const swing = arr(dynamics, "swing_stakeholders");
    const relRisks = arr(dynamics, "relationship_risks");
    if (allies.length > 0) {
      lines.push(`**Likely allies:** ${allies.map(String).join(", ")}`);
    }
    if (dBlockers.length > 0) {
      lines.push(`**Likely blockers:** ${dBlockers.map(String).join(", ")}`);
    }
    if (swing.length > 0) {
      lines.push(
        `**Swing stakeholders:** ${swing.map(String).join(", ")}`,
      );
    }
    if (relRisks.length > 0) {
      lines.push("**Relationship risks:**");
      for (const r of relRisks) {
        lines.push(bullet(String(r)));
      }
    }
  }

  // Risks
  if (risks.length > 0) {
    for (const r of risks) {
      const id = str(r, "id");
      const title = str(r, "title");
      const severity = num(r, "severity");
      const likelihood = num(r, "likelihood");
      const ownerRec = str(r, "owner_recommendation");
      const signals = arr(r, "early_signals");
      const mitigation = str(r, "mitigation");

      lines.push("");
      lines.push(
        `### Risk ${id}: ${title} (severity ${severity}/5, likelihood ${likelihood}/5)`,
      );
      lines.push(`**Owner recommendation:** ${ownerRec}`);
      lines.push(`**Mitigation:** ${mitigation}`);
      if (signals.length > 0) {
        lines.push("**Early signals:**");
        for (const sig of signals) {
          lines.push(bullet(String(sig)));
        }
      }
    }
  }

  // Engagement plan
  if (engagement.length > 0) {
    lines.push("");
    lines.push("### Engagement Plan");
    for (const e of engagement) {
      lines.push("");
      lines.push(
        `**${str(e, "stakeholder")}** — Objective: ${str(e, "objective")}`,
      );
      lines.push(`Message frame: ${str(e, "message_frame")}`);
      lines.push(`Ask: ${str(e, "ask")}`);
      lines.push(
        `Channel: ${str(e, "channel")} | Timing: ${str(e, "timing")} | Owner: ${str(e, "owner")}`,
      );
      lines.push(`Success signal: ${str(e, "success_signal")}`);
    }
  }

  // 7-day actions
  if (actions7.length > 0) {
    const actionItems: string[] = [];
    for (const a of actions7) {
      actionItems.push(
        bullet(
          `${str(a, "action")} → **${str(a, "owner")}** (due: ${str(a, "due")}) | Proof: ${str(a, "proof_artifact")}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Next 7-Day Actions", actionItems));
  }

  // Open questions
  if (openQs.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Open Questions",
        openQs.map((q) => bullet(String(q))),
      ),
    );
  }

  // Recommended path
  if (recPath) {
    const pathStatus = str(recPath, "status");
    const overallRec = str(recPath, "overall_recommendation");

    lines.push("");
    lines.push(`### Recommended Path (${pathStatus})`);
    if (overallRec) {
      lines.push(overallRec);
    }

    if (pathStatus === "actionable") {
      const leverage = arr(recPath, "leverage");
      const improve = arr(recPath, "improve_relations");
      const watch = arr(recPath, "watch_list");

      if (leverage.length > 0) {
        lines.push("**Leverage:**");
        for (const l of leverage) {
          lines.push(
            bullet(
              `**${str(l, "stakeholder")}** — Why: ${str(l, "why")} | How: ${str(l, "how")}`,
            ),
          );
        }
      }
      if (improve.length > 0) {
        lines.push("**Improve relations:**");
        for (const i of improve) {
          lines.push(
            bullet(
              `**${str(i, "stakeholder")}** — Why: ${str(i, "why")} | How: ${str(i, "how")}`,
            ),
          );
        }
      }
      if (watch.length > 0) {
        lines.push("**Watch list:**");
        for (const w of watch) {
          lines.push(
            bullet(
              `**${str(w, "stakeholder")}** — Signal: ${str(w, "signal")} | Contingency: ${str(w, "contingency")}`,
            ),
          );
        }
      }
    } else if (pathStatus === "insufficient_information") {
      const gaps = arr(recPath, "information_gaps");
      const nextSteps = arr(recPath, "suggested_next_steps");
      if (gaps.length > 0) {
        lines.push("**Information gaps:**");
        for (const g of gaps) {
          lines.push(bullet(String(g)));
        }
      }
      if (nextSteps.length > 0) {
        lines.push("**Suggested next steps:**");
        for (const s of nextSteps) {
          lines.push(bullet(String(s)));
        }
      }
    }
  }

  // Citations
  if (citations.length > 0) {
    const citItems: string[] = [];
    for (const c of citations) {
      citItems.push(
        `→ "${str(c, "quote")}" — ${str(c, "speaker")}, ${str(c, "approximate_location")}`,
      );
    }
    lines.push("");
    lines.push(section("Citations", citItems));
  }

  return lines.join("\n");
}

// ── Decision Quality Audit ──────────────────────────────────────────

function formatDecisionQualityAuditInsight(data: unknown): string {
  const lines: string[] = [];

  const execSummary = str(data, "executive_summary");
  const decisionSurface = str(data, "decision_surface");
  const status = str(data, "decision_status", "unknown");
  const score = num(data, "decision_quality_score");
  const breakdown = field(data, "score_breakdown") as Obj | undefined;
  const strengths = arr(data, "strengths");
  const gaps = arr(data, "gaps");
  const assumptions = arr(data, "assumptions");
  const altsMissing = arr(data, "alternatives_missing");
  const risksUnder = arr(data, "risks_underweighted");
  const accountability = arr(data, "accountability_snapshot");
  const upgrades = arr(data, "decision_hygiene_upgrades_next_meeting");
  const singleUpgrade = field(data, "single_most_important_upgrade");
  const citations = arr(data, "citations");

  lines.push("## Decision Quality Audit");
  lines.push("");
  lines.push(
    `**Decision Quality: ${score}/100** — status: ${status}, ${gaps.length} gap${gaps.length !== 1 ? "s" : ""} identified`,
  );

  if (execSummary) {
    lines.push("");
    lines.push(execSummary);
  }

  if (decisionSurface) {
    lines.push("");
    lines.push(`**Decision surface:** ${decisionSurface}`);
  }

  // Score breakdown — all 6 dimensions
  if (breakdown) {
    const dims = [
      ["Clarity of Decision", num(breakdown, "clarity_of_decision")] as const,
      ["Evidence Quality", num(breakdown, "evidence_quality")] as const,
      [
        "Alternatives Considered",
        num(breakdown, "alternatives_considered"),
      ] as const,
      [
        "Risk Assessment Quality",
        num(breakdown, "risk_assessment_quality"),
      ] as const,
      [
        "Ownership & Accountability",
        num(breakdown, "ownership_and_accountability"),
      ] as const,
      [
        "Reversibility & Checkpoints",
        num(breakdown, "reversibility_and_checkpoints"),
      ] as const,
    ];
    const dimItems = dims.map(([name, val]) =>
      bullet(`**${name}:** ${val}/100`),
    );
    lines.push("");
    lines.push(section("Score Breakdown", dimItems));
  }

  // Strengths
  if (strengths.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Strengths",
        strengths.map((s) => bullet(String(s))),
      ),
    );
  }

  // Gaps — full detail
  if (gaps.length > 0) {
    for (const g of gaps) {
      const gap = str(g, "gap");
      const why = str(g, "why_it_matters");
      const impact = str(g, "impact_level");
      const fix = str(g, "fix");
      const evidence = arr(g, "evidence");

      lines.push("");
      lines.push(`### Gap: ${gap} (impact: ${impact})`);
      lines.push(why);
      lines.push(`**Fix:** ${fix}`);
      if (evidence.length > 0) {
        for (const e of evidence) {
          lines.push(
            `→ "${str(e, "quote")}" — ${str(e, "speaker")}, ${str(e, "approximate_location")}`,
          );
        }
      }
    }
  }

  // Assumptions
  if (assumptions.length > 0) {
    const assItems: string[] = [];
    for (const a of assumptions) {
      const assumption = str(a, "assumption");
      const explicit = str(a, "explicit_or_implicit");
      const validated = str(a, "validated");
      const test = str(a, "how_to_test_fast");
      assItems.push(
        bullet(
          `**${assumption}** (${explicit}, validated: ${validated}) — Test: ${test}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Assumptions", assItems));
  }

  // Alternatives missing
  if (altsMissing.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Alternatives Missing",
        altsMissing.map((a) => bullet(String(a))),
      ),
    );
  }

  // Risks underweighted
  if (risksUnder.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Risks Underweighted",
        risksUnder.map((r) => bullet(String(r))),
      ),
    );
  }

  // Accountability snapshot
  if (accountability.length > 0) {
    const accItems: string[] = [];
    for (const a of accountability) {
      accItems.push(
        bullet(
          `**${str(a, "owner")}**: ${str(a, "commitment")} (due: ${str(a, "due_or_window")}, confidence: ${str(a, "confidence")}) | Proof: ${str(a, "proof_artifact")}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Accountability Snapshot", accItems));
  }

  // Hygiene upgrades
  if (upgrades.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Decision Hygiene Upgrades",
        upgrades.map((u) => bullet(String(u))),
      ),
    );
  }

  // Single most important upgrade
  if (singleUpgrade) {
    lines.push("");
    lines.push("### Most Important Upgrade");
    lines.push(`→ **${str(singleUpgrade, "upgrade")}** — ${str(singleUpgrade, "why")}`);
    lines.push(
      `Owner: ${str(singleUpgrade, "owner")} | Deadline: ${str(singleUpgrade, "deadline")} | Success signal: ${str(singleUpgrade, "success_signal")}`,
    );
  }

  // Citations
  if (citations.length > 0) {
    const citItems: string[] = [];
    for (const c of citations) {
      citItems.push(
        `→ "${str(c, "quote")}" — ${str(c, "speaker")}, ${str(c, "approximate_location")}`,
      );
    }
    lines.push("");
    lines.push(section("Citations", citItems));
  }

  return lines.join("\n");
}

// ── Meeting Risk Analysis ───────────────────────────────────────────

function formatMeetingRiskAnalysisInsight(data: unknown): string {
  const lines: string[] = [];

  const execSummary = str(data, "executive_summary");
  const riskLevel = str(data, "overall_risk_level", "unknown");
  const confidence = num(data, "confidence");
  const risks = arr(data, "risks");
  const tensions = arr(data, "unresolved_tensions");
  const assumptions = arr(data, "hidden_assumptions");
  const decisionGaps = arr(data, "decision_gaps");
  const actions = arr(data, "recommended_actions");

  lines.push("## Meeting Risk Analysis");
  lines.push("");
  lines.push(
    `**Overall Risk: ${riskLevel}** | Confidence: ${confidence} | ${risks.length} risk${risks.length !== 1 ? "s" : ""}, ${tensions.length} unresolved tension${tensions.length !== 1 ? "s" : ""}`,
  );

  if (execSummary) {
    lines.push("");
    lines.push(execSummary);
  }

  // Risks — full detail
  const sorted = [...risks].sort(
    (a, b) => {
      const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (sevOrder[str(a, "severity")] ?? 3) - (sevOrder[str(b, "severity")] ?? 3);
    },
  );
  for (const r of sorted) {
    const title = str(r, "title");
    const severity = str(r, "severity");
    const likelihood = str(r, "likelihood");
    const impact = str(r, "impact");
    const owner = str(r, "owner");
    const mitigation = str(r, "mitigation");
    const quotes = arr(r, "evidence_quotes");

    lines.push("");
    lines.push(
      `### ${title} (severity: ${severity}, likelihood: ${likelihood})`,
    );
    lines.push(`**Impact:** ${impact}`);
    lines.push(`**Owner:** ${owner}`);
    lines.push(`**Mitigation:** ${mitigation}`);
    if (quotes.length > 0) {
      for (const q of quoteLines(quotes)) {
        lines.push(q);
      }
    }
  }

  // Unresolved tensions
  if (tensions.length > 0) {
    for (const t of tensions) {
      const tension = str(t, "tension");
      const sides = arr(t, "sides");
      const why = str(t, "why_it_matters");
      const quotes = arr(t, "evidence_quotes");

      lines.push("");
      lines.push(`### Tension: ${tension}`);
      lines.push(`**Sides:** ${sides.map(String).join(" vs. ")}`);
      lines.push(`**Why it matters:** ${why}`);
      if (quotes.length > 0) {
        for (const q of quoteLines(quotes)) {
          lines.push(q);
        }
      }
    }
  }

  // Hidden assumptions
  if (assumptions.length > 0) {
    for (const a of assumptions) {
      const assumption = str(a, "assumption");
      const riskIfFalse = str(a, "risk_if_false");
      const quotes = arr(a, "evidence_quotes");

      lines.push("");
      lines.push(`### Assumption: ${assumption}`);
      lines.push(`**Risk if false:** ${riskIfFalse}`);
      if (quotes.length > 0) {
        for (const q of quoteLines(quotes)) {
          lines.push(q);
        }
      }
    }
  }

  // Decision gaps
  if (decisionGaps.length > 0) {
    const gapItems: string[] = [];
    for (const g of decisionGaps) {
      gapItems.push(
        bullet(
          `**${str(g, "missing_decision")}** — Blocker: ${str(g, "blocker")} | Suggested owner: ${str(g, "suggested_decision_owner")}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Decision Gaps", gapItems));
  }

  // Recommended actions
  if (actions.length > 0) {
    const actionItems: string[] = [];
    for (const a of actions) {
      actionItems.push(
        bullet(
          `${str(a, "action")} → **${str(a, "owner")}** (due: ${str(a, "due_date")}) | Success artifact: ${str(a, "success_artifact")}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Recommended Actions", actionItems));
  }

  return lines.join("\n");
}

// ── Red Team ────────────────────────────────────────────────────────

function formatRedteamInsight(data: unknown): string {
  const lines: string[] = [];

  const summary = str(data, "summary");
  const riskLevel = str(data, "overall_risk_level", "unknown");
  const thesis = str(data, "thesis_under_test");
  const assumptions = arr(data, "key_assumptions");
  const failures = arr(data, "failure_modes");
  const adversarial = arr(data, "adversarial_questions");
  const rec = field(data, "decision_recommendation");
  const commitments = arr(data, "commitments_extracted");
  const citations = arr(data, "citations");

  lines.push("## Red Team Analysis");
  lines.push("");
  lines.push(
    `**Risk Level: ${riskLevel}** — ${failures.length} failure mode${failures.length !== 1 ? "s" : ""} identified`,
  );

  if (rec) {
    lines.push(`**Recommendation: ${str(rec, "recommendation")}**`);
  }

  if (summary) {
    lines.push("");
    lines.push(summary);
  }

  if (thesis) {
    lines.push("");
    lines.push(`**Thesis under test:** ${thesis}`);
  }

  // Key assumptions
  if (assumptions.length > 0) {
    const assItems: string[] = [];
    for (const a of assumptions) {
      const assumption = str(a, "assumption");
      const confidence = num(a, "confidence");
      const evidence = str(a, "evidence_from_transcript");
      assItems.push(
        bullet(`**${assumption}** (confidence: ${confidence})`),
      );
      if (evidence) {
        assItems.push(`  → "${evidence}"`);
      }
    }
    lines.push("");
    lines.push(section("Key Assumptions", assItems));
  }

  // Failure modes — full detail
  const sorted = [...failures].sort(
    (a, b) => num(b, "severity") - num(a, "severity"),
  );
  for (const f of sorted) {
    const id = str(f, "id");
    const title = str(f, "title");
    const severity = num(f, "severity");
    const likelihood = num(f, "likelihood");
    const why = str(f, "why_it_fails");
    const indicators = arr(f, "leading_indicators");
    const mitigation = str(f, "mitigation");

    lines.push("");
    lines.push(
      `### ${id}: ${title} (severity ${severity}/5, likelihood ${likelihood}/5)`,
    );
    lines.push(why);
    lines.push(`**Mitigation:** ${mitigation}`);
    if (indicators.length > 0) {
      lines.push("**Leading indicators:**");
      for (const ind of indicators) {
        lines.push(bullet(String(ind)));
      }
    }
  }

  // Adversarial questions
  if (adversarial.length > 0) {
    lines.push("");
    lines.push(
      section(
        "Adversarial Questions",
        adversarial.map((q) => bullet(String(q))),
      ),
    );
  }

  // Decision recommendation — full detail
  if (rec) {
    lines.push("");
    lines.push("### Decision Recommendation");
    lines.push(
      `→ **${str(rec, "recommendation")}** — ${str(rec, "rationale")}`,
    );
    const checks = arr(rec, "required_next_checks");
    if (checks.length > 0) {
      lines.push("**Required next checks:**");
      for (const c of checks) {
        lines.push(bullet(String(c)));
      }
    }
  }

  // Commitments extracted
  if (commitments.length > 0) {
    const cmtItems: string[] = [];
    for (const c of commitments) {
      cmtItems.push(
        bullet(
          `${str(c, "commitment")} → **${str(c, "owner")}** (due: ${str(c, "due_date_or_window")}) | Proof: ${str(c, "proof_artifact")}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Commitments Extracted", cmtItems));
  }

  // Citations
  if (citations.length > 0) {
    const citItems: string[] = [];
    for (const c of citations) {
      citItems.push(
        `→ "${str(c, "quote")}" — ${str(c, "speaker")}, ${str(c, "approximate_location")}`,
      );
    }
    lines.push("");
    lines.push(section("Citations", citItems));
  }

  return lines.join("\n");
}

// ── Effective Communication ─────────────────────────────────────────

function formatEffectiveCommunicationInsight(data: unknown): string {
  const lines: string[] = [];

  const execSummary = str(data, "executive_summary");
  const score = num(data, "overall_effectiveness_score");
  const status = str(data, "communication_status", "unknown");
  const coachTake = str(data, "coach_take");
  const breakdown = field(data, "score_breakdown") as Obj | undefined;
  const whatWorked = arr(data, "what_worked");
  const improvements = arr(data, "priority_improvements");
  const missed = arr(data, "missed_opportunities");
  const fillers = arr(data, "filler_or_hedging_patterns");
  const talkTime = field(data, "talk_time_signal");
  const gameplan = field(data, "next_meeting_gameplan");
  const oneThing = field(data, "one_thing_to_change_next_meeting");
  const citations = arr(data, "citations");

  lines.push("## Communication Coaching");
  lines.push("");
  lines.push(
    `**Effectiveness: ${score}/100** — ${status.replace(/_/g, " ")} — ${improvements.length} improvement${improvements.length !== 1 ? "s" : ""} identified`,
  );

  if (execSummary) {
    lines.push("");
    lines.push(execSummary);
  }

  if (coachTake) {
    lines.push("");
    lines.push(`**Coach take:** ${coachTake}`);
  }

  // Score breakdown — all 7 dimensions
  if (breakdown) {
    const dims = [
      ["Clarity", num(breakdown, "clarity")] as const,
      ["Brevity", num(breakdown, "brevity")] as const,
      ["Structure", num(breakdown, "structure")] as const,
      ["Audience Alignment", num(breakdown, "audience_alignment")] as const,
      ["Executive Presence", num(breakdown, "executive_presence")] as const,
      ["Action Orientation", num(breakdown, "action_orientation")] as const,
      [
        "Listening & Responsiveness",
        num(breakdown, "listening_and_responsiveness"),
      ] as const,
    ];
    const dimItems = dims.map(([name, val]) =>
      bullet(`**${name}:** ${val}/100`),
    );
    lines.push("");
    lines.push(section("Score Breakdown", dimItems));
  }

  // What worked
  if (whatWorked.length > 0) {
    lines.push("");
    lines.push(
      section(
        "What Worked",
        whatWorked.map((w) => bullet(String(w))),
      ),
    );
  }

  // Priority improvements — full detail
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
  for (const i of sortedImprovements) {
    const theme = str(i, "theme");
    const impact = str(i, "impact_level");
    const diagnosis = str(i, "diagnosis");
    const cost = str(i, "why_it_costs_you");
    const evidence = arr(i, "evidence");
    const rewrite = field(i, "rewrite");
    const drill = str(i, "drill");

    lines.push("");
    lines.push(`### ${theme} (${impact} impact)`);
    lines.push(`**Diagnosis:** ${diagnosis}`);
    lines.push(`**Why it costs you:** ${cost}`);
    if (evidence.length > 0) {
      for (const e of evidence) {
        lines.push(
          `→ "${str(e, "quote")}" — ${str(e, "speaker")}, ${str(e, "approximate_location")}`,
        );
      }
    }
    if (rewrite) {
      lines.push(`**Before:** ${str(rewrite, "before")}`);
      lines.push(`**After:** ${str(rewrite, "after")}`);
      lines.push(`**Why better:** ${str(rewrite, "why_better")}`);
    }
    if (drill) {
      lines.push(`**Drill:** ${drill}`);
    }
  }

  // Missed opportunities
  if (missed.length > 0) {
    for (const m of missed) {
      lines.push("");
      lines.push(`### Missed Opportunity: ${str(m, "moment")}`);
      lines.push(`**What happened:** ${str(m, "what_happened")}`);
      lines.push(`**Better move:** ${str(m, "better_move")}`);
      lines.push(`**Sample line:** ${str(m, "sample_line")}`);
    }
  }

  // Filler / hedging patterns
  if (fillers.length > 0) {
    const fillerItems: string[] = [];
    for (const f of fillers) {
      fillerItems.push(
        bullet(
          `**"${str(f, "pattern")}"** (~${str(f, "count_estimate")}) → Replace with: ${str(f, "replacement_pattern")}`,
        ),
      );
    }
    lines.push("");
    lines.push(section("Filler & Hedging Patterns", fillerItems));
  }

  // Talk time signal
  if (talkTime) {
    lines.push("");
    lines.push("### Talk Time Signal");
    lines.push(
      `Your share: ${str(talkTime, "user_share_estimate")} | Balance: ${str(talkTime, "balance_assessment")}`,
    );
    const note = str(talkTime, "note");
    if (note) {
      lines.push(note);
    }
  }

  // Next meeting gameplan
  if (gameplan) {
    lines.push("");
    lines.push("### Next Meeting Gameplan");
    const opening = str(gameplan, "opening_script");
    if (opening) {
      lines.push(`**Opening script:** ${opening}`);
    }
    const nonNeg = arr(gameplan, "three_non_negotiables");
    if (nonNeg.length > 0) {
      lines.push("**Three non-negotiables:**");
      for (const n of nonNeg) {
        lines.push(bullet(String(n)));
      }
    }
    const pushback = str(gameplan, "pushback_response_template");
    if (pushback) {
      lines.push(`**Pushback response template:** ${pushback}`);
    }
    const closing = str(gameplan, "closing_script");
    if (closing) {
      lines.push(`**Closing script:** ${closing}`);
    }
  }

  // One thing to change
  if (oneThing) {
    lines.push("");
    lines.push("### One Thing to Change");
    lines.push(`→ **${str(oneThing, "change")}** — ${str(oneThing, "why")}`);
    const signal = str(oneThing, "success_signal");
    if (signal) {
      lines.push(`Success signal: ${signal}`);
    }
  }

  // Citations
  if (citations.length > 0) {
    const citItems: string[] = [];
    for (const c of citations) {
      citItems.push(
        `→ "${str(c, "quote")}" — ${str(c, "speaker")}, ${str(c, "approximate_location")}`,
      );
    }
    lines.push("");
    lines.push(section("Citations", citItems));
  }

  return lines.join("\n");
}
