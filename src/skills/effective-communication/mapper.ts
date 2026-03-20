import type {
  EffectiveCommunicationInput,
  EffectiveCommunicationOutput,
  CommunicationStatus,
  ImpactLevel,
  BalanceAssessment,
  ModeUsed,
  AnalysisDepth,
  ScoreBreakdown,
  PriorityImprovement,
  EvidenceEntry,
  Rewrite,
  MissedOpportunity,
  FillerPattern,
  TalkTimeSignal,
  NextMeetingGameplan,
  OneThingToChange,
  Citation,
} from "./types.js";

// ── Valid enum sets ─────────────────────────────────────────────────

const COMMUNICATION_STATUSES = new Set<CommunicationStatus>([
  "excellent", "strong_with_gaps", "mixed", "needs_improvement",
]);
const IMPACT_LEVELS = new Set<ImpactLevel>(["low", "medium", "high", "critical"]);
const BALANCE_ASSESSMENTS = new Set<BalanceAssessment>([
  "under_talking", "balanced", "over_talking", "unknown",
]);
const ANALYSIS_DEPTHS = new Set<AnalysisDepth>(["quick", "standard", "deep"]);

// ── Helpers ─────────────────────────────────────────────────────────

function clampEnum<T extends string>(
  value: unknown,
  valid: Set<T>,
  fallback: T,
): T {
  if (typeof value === "string" && valid.has(value as T)) return value as T;
  return fallback;
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asObj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// ── Mode and depth detection ────────────────────────────────────────

export function detectMode(
  input: EffectiveCommunicationInput,
): ModeUsed {
  if (
    input.user_name !== undefined ||
    input.communication_goal !== undefined ||
    input.audience_context !== undefined ||
    input.tone_target !== undefined ||
    input.analysis_depth !== undefined ||
    (input.participant_directory !== undefined && input.participant_directory.length > 0) ||
    (input.focus_areas !== undefined && input.focus_areas.length > 0) ||
    (input.key_questions !== undefined && input.key_questions.length > 0) ||
    input.meeting_title !== undefined ||
    input.meeting_datetime !== undefined
  ) {
    return "transcript_plus_context";
  }
  return "transcript_only";
}

export function detectDepth(
  input: EffectiveCommunicationInput,
): AnalysisDepth {
  return clampEnum(input.analysis_depth, ANALYSIS_DEPTHS, "standard");
}

// ── Evidence normalizer ─────────────────────────────────────────────

function normalizeEvidence(raw: unknown): EvidenceEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ speaker: "Unknown", quote: "", approximate_location: "" }];
  }
  return raw.map((e: unknown) => {
    const entry = asObj(e);
    return {
      speaker: asString(entry.speaker, "Unknown"),
      quote: asString(entry.quote),
      approximate_location: asString(entry.approximate_location),
    };
  });
}

function normalizeRewrite(raw: unknown): Rewrite {
  const obj = asObj(raw);
  return {
    before: asString(obj.before),
    after: asString(obj.after),
    why_better: asString(obj.why_better),
  };
}

function normalizeCitation(raw: unknown): Citation {
  const obj = asObj(raw);
  return {
    quote: asString(obj.quote),
    speaker: asString(obj.speaker, "Unknown"),
    approximate_location: asString(obj.approximate_location),
  };
}

// ── Core normalizer ─────────────────────────────────────────────────

export interface NormalizeResult {
  output: EffectiveCommunicationOutput;
  warnings: string[];
}

export function normalizeOutput(
  raw: unknown,
  input: EffectiveCommunicationInput,
): NormalizeResult {
  const warnings: string[] = [];
  const obj = asObj(raw);

  // Score breakdown
  const rawBreakdown = asObj(obj.score_breakdown);
  const scoreBreakdown: ScoreBreakdown = {
    clarity: clampScore(rawBreakdown.clarity),
    brevity: clampScore(rawBreakdown.brevity),
    structure: clampScore(rawBreakdown.structure),
    audience_alignment: clampScore(rawBreakdown.audience_alignment),
    executive_presence: clampScore(rawBreakdown.executive_presence),
    action_orientation: clampScore(rawBreakdown.action_orientation),
    listening_and_responsiveness: clampScore(rawBreakdown.listening_and_responsiveness),
  };

  // Overall score
  const overallScore = clampScore(obj.overall_effectiveness_score);

  // Communication status — derive from score if LLM value is invalid
  let communicationStatus = clampEnum(
    obj.communication_status,
    COMMUNICATION_STATUSES,
    "mixed",
  );
  const derivedStatus = deriveStatus(overallScore);
  if (communicationStatus !== derivedStatus) {
    warnings.push(
      `communication_status corrected from "${String(obj.communication_status)}" to "${derivedStatus}" based on score ${overallScore}`,
    );
    communicationStatus = derivedStatus;
  }

  // Priority improvements
  const rawImprovements = Array.isArray(obj.priority_improvements)
    ? obj.priority_improvements
    : [];
  const priorityImprovements: PriorityImprovement[] = rawImprovements.map(
    (item: unknown) => {
      const pi = asObj(item);
      return {
        theme: asString(pi.theme, "Unnamed improvement"),
        diagnosis: asString(pi.diagnosis),
        why_it_costs_you: asString(pi.why_it_costs_you),
        impact_level: clampEnum(pi.impact_level, IMPACT_LEVELS, "medium"),
        evidence: normalizeEvidence(pi.evidence),
        rewrite: normalizeRewrite(pi.rewrite),
        drill: asString(pi.drill),
      };
    },
  );

  // Missed opportunities
  const rawMissed = Array.isArray(obj.missed_opportunities)
    ? obj.missed_opportunities
    : [];
  const missedOpportunities: MissedOpportunity[] = rawMissed.map(
    (item: unknown) => {
      const mo = asObj(item);
      return {
        moment: asString(mo.moment),
        what_happened: asString(mo.what_happened),
        better_move: asString(mo.better_move),
        sample_line: asString(mo.sample_line),
      };
    },
  );

  // Filler patterns
  const rawFillers = Array.isArray(obj.filler_or_hedging_patterns)
    ? obj.filler_or_hedging_patterns
    : [];
  const fillerPatterns: FillerPattern[] = rawFillers.map((item: unknown) => {
    const fp = asObj(item);
    return {
      pattern: asString(fp.pattern),
      count_estimate: asString(fp.count_estimate),
      replacement_pattern: asString(fp.replacement_pattern),
    };
  });

  // Talk time signal
  const rawTalkTime = asObj(obj.talk_time_signal);
  const talkTimeSignal: TalkTimeSignal = {
    user_share_estimate: asString(rawTalkTime.user_share_estimate, "unknown"),
    balance_assessment: clampEnum(
      rawTalkTime.balance_assessment,
      BALANCE_ASSESSMENTS,
      "unknown",
    ),
    note: asString(rawTalkTime.note),
  };

  // Next meeting gameplan
  const rawGameplan = asObj(obj.next_meeting_gameplan);
  const rawNonNeg = Array.isArray(rawGameplan.three_non_negotiables)
    ? rawGameplan.three_non_negotiables.map(String)
    : [];
  // Ensure exactly 3 items
  while (rawNonNeg.length < 3) rawNonNeg.push("");
  const threeNonNeg = rawNonNeg.slice(0, 3) as [string, string, string];
  if (rawNonNeg.length !== 3) {
    warnings.push("three_non_negotiables was adjusted to exactly 3 items");
  }

  const nextMeetingGameplan: NextMeetingGameplan = {
    opening_script: asString(rawGameplan.opening_script),
    three_non_negotiables: threeNonNeg,
    pushback_response_template: asString(rawGameplan.pushback_response_template),
    closing_script: asString(rawGameplan.closing_script),
  };

  // One thing to change
  const rawOneThing = asObj(obj.one_thing_to_change_next_meeting);
  const oneThingToChange: OneThingToChange = {
    change: asString(rawOneThing.change),
    why: asString(rawOneThing.why),
    success_signal: asString(rawOneThing.success_signal),
  };

  // Citations
  const rawCitations = Array.isArray(obj.citations) ? obj.citations : [];
  const citations: Citation[] = rawCitations.map(normalizeCitation);

  // What worked
  const whatWorked = Array.isArray(obj.what_worked)
    ? (obj.what_worked as unknown[]).map(String)
    : [];

  // Metadata — deterministic, overwrite LLM values
  const modeUsed = detectMode(input);
  const analysisDepthUsed = detectDepth(input);

  const output: EffectiveCommunicationOutput = {
    executive_summary: asString(obj.executive_summary),
    overall_effectiveness_score: overallScore,
    communication_status: communicationStatus,
    coach_take: asString(obj.coach_take),
    score_breakdown: scoreBreakdown,
    what_worked: whatWorked,
    priority_improvements: priorityImprovements,
    missed_opportunities: missedOpportunities,
    filler_or_hedging_patterns: fillerPatterns,
    talk_time_signal: talkTimeSignal,
    next_meeting_gameplan: nextMeetingGameplan,
    one_thing_to_change_next_meeting: oneThingToChange,
    citations,
    metadata: {
      mode_used: modeUsed,
      analysis_depth_used: analysisDepthUsed,
      generated_at: new Date().toISOString(),
    },
  };

  return { output, warnings };
}

// ── Status derivation ───────────────────────────────────────────────

function deriveStatus(score: number): CommunicationStatus {
  if (score >= 80) return "excellent";
  if (score >= 60) return "strong_with_gaps";
  if (score >= 40) return "mixed";
  return "needs_improvement";
}
