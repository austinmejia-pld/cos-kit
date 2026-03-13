import type {
  DecisionQualityAuditInput,
  DecisionQualityAuditOutput,
  DecisionStatus,
  ImpactLevel,
  ExplicitOrImplicit,
  Validated,
  Confidence,
  ModeUsed,
  ScoreBreakdown,
  EvidenceEntry,
  Gap,
  Assumption,
  AccountabilityEntry,
  SingleUpgrade,
  Citation,
} from "./types.js";

// ── Enum normalization maps ─────────────────────────────────────────

const DECISION_STATUS_MAP: Record<string, DecisionStatus> = {
  clear_decision: "clear_decision",
  clear: "clear_decision",
  decided: "clear_decision",
  yes: "clear_decision",
  tentative_decision: "tentative_decision",
  tentative: "tentative_decision",
  leaning: "tentative_decision",
  partial: "tentative_decision",
  no_decision: "no_decision",
  none: "no_decision",
  no: "no_decision",
  deferred: "no_decision",
  undecided: "no_decision",
};

const IMPACT_LEVEL_MAP: Record<string, ImpactLevel> = {
  low: "low",
  minor: "low",
  medium: "medium",
  moderate: "medium",
  high: "high",
  major: "high",
  significant: "high",
  critical: "critical",
  severe: "critical",
  blocking: "critical",
};

const EXPLICIT_IMPLICIT_MAP: Record<string, ExplicitOrImplicit> = {
  explicit: "explicit",
  stated: "explicit",
  direct: "explicit",
  implicit: "implicit",
  implied: "implicit",
  inferred: "implicit",
  unstated: "implicit",
};

const VALIDATED_MAP: Record<string, Validated> = {
  yes: "yes",
  validated: "yes",
  confirmed: "yes",
  partial: "partial",
  partially: "partial",
  some: "partial",
  no: "no",
  unvalidated: "no",
  none: "no",
  unknown: "unknown",
  unclear: "unknown",
};

const CONFIDENCE_MAP: Record<string, Confidence> = {
  low: "low",
  weak: "low",
  uncertain: "low",
  medium: "medium",
  moderate: "medium",
  high: "high",
  strong: "high",
  confident: "high",
};

// ── Helpers ──────────────────────────────────────────────────────────

function normalizeEnum<T extends string>(
  value: unknown,
  map: Record<string, T>,
  fallback: T,
): T {
  if (typeof value !== "string") return fallback;
  const key = value.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return map[key] ?? fallback;
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function normalizeArray<T>(
  value: unknown,
  normalizer: (item: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is Record<string, unknown> =>
        typeof v === "object" && v !== null,
    )
    .map(normalizer);
}

// ── Token overlap for deduplication ─────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((t) => t.length > 0),
  );
}

function tokenOverlap(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let shared = 0;
  for (const tok of setA) {
    if (setB.has(tok)) shared++;
  }
  return shared / Math.max(setA.size, setB.size);
}

// ── Sub-normalizers ─────────────────────────────────────────────────

function normalizeEvidenceEntry(raw: Record<string, unknown>): EvidenceEntry {
  return {
    speaker: asString(raw.speaker, "Unknown"),
    quote: asString(raw.quote, ""),
    approximate_location: asString(raw.approximate_location, ""),
  };
}

function normalizeGap(raw: Record<string, unknown>): Gap {
  const evidenceRaw = Array.isArray(raw.evidence) ? raw.evidence : [];
  const evidence: EvidenceEntry[] = evidenceRaw
    .filter(
      (e): e is Record<string, unknown> =>
        typeof e === "object" && e !== null,
    )
    .map(normalizeEvidenceEntry);

  if (evidence.length === 0) {
    evidence.push({ speaker: "Unknown", quote: "", approximate_location: "" });
  }

  return {
    gap: asString(raw.gap, "Untitled gap"),
    why_it_matters: asString(raw.why_it_matters, ""),
    impact_level: normalizeEnum(raw.impact_level, IMPACT_LEVEL_MAP, "medium"),
    evidence,
    fix: asString(raw.fix, ""),
  };
}

function normalizeAssumption(raw: Record<string, unknown>): Assumption {
  return {
    assumption: asString(raw.assumption, ""),
    explicit_or_implicit: normalizeEnum(
      raw.explicit_or_implicit,
      EXPLICIT_IMPLICIT_MAP,
      "implicit",
    ),
    validated: normalizeEnum(raw.validated, VALIDATED_MAP, "unknown"),
    how_to_test_fast: asString(raw.how_to_test_fast, ""),
  };
}

function normalizeAccountabilityEntry(
  raw: Record<string, unknown>,
): AccountabilityEntry {
  return {
    owner: asString(raw.owner, "Unassigned"),
    commitment: asString(raw.commitment, ""),
    due_or_window: asString(raw.due_or_window, ""),
    proof_artifact: asString(raw.proof_artifact, ""),
    confidence: normalizeEnum(raw.confidence, CONFIDENCE_MAP, "medium"),
  };
}

function normalizeSingleUpgrade(raw: unknown): SingleUpgrade {
  const obj = (typeof raw === "object" && raw !== null
    ? raw
    : {}) as Record<string, unknown>;
  return {
    upgrade: asString(obj.upgrade, ""),
    why: asString(obj.why, ""),
    owner: asString(obj.owner, "Unassigned"),
    deadline: asString(obj.deadline, ""),
    success_signal: asString(obj.success_signal, ""),
  };
}

function normalizeCitation(raw: Record<string, unknown>): Citation {
  return {
    quote: asString(raw.quote, ""),
    speaker: asString(raw.speaker, "Unknown"),
    approximate_location: asString(raw.approximate_location, ""),
  };
}

function normalizeScoreBreakdown(raw: unknown): ScoreBreakdown {
  const obj = (typeof raw === "object" && raw !== null
    ? raw
    : {}) as Record<string, unknown>;
  return {
    clarity_of_decision: clampInt(obj.clarity_of_decision, 0, 100),
    evidence_quality: clampInt(obj.evidence_quality, 0, 100),
    alternatives_considered: clampInt(obj.alternatives_considered, 0, 100),
    risk_assessment_quality: clampInt(obj.risk_assessment_quality, 0, 100),
    ownership_and_accountability: clampInt(
      obj.ownership_and_accountability,
      0,
      100,
    ),
    reversibility_and_checkpoints: clampInt(
      obj.reversibility_and_checkpoints,
      0,
      100,
    ),
  };
}

// ── Deduplication ───────────────────────────────────────────────────

const IMPACT_RANK: Record<ImpactLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function deduplicateGaps(gaps: Gap[]): Gap[] {
  const result: Gap[] = [];

  for (const candidate of gaps) {
    const duplicate = result.find(
      (existing) => tokenOverlap(existing.gap, candidate.gap) > 0.8,
    );

    if (duplicate) {
      if (IMPACT_RANK[candidate.impact_level] > IMPACT_RANK[duplicate.impact_level]) {
        const mergedEvidence = mergeEvidence(
          candidate.evidence,
          duplicate.evidence,
        );
        Object.assign(duplicate, { ...candidate, evidence: mergedEvidence });
      } else {
        duplicate.evidence = mergeEvidence(
          duplicate.evidence,
          candidate.evidence,
        );
      }
    } else {
      result.push({ ...candidate });
    }
  }

  return result;
}

function mergeEvidence(
  primary: EvidenceEntry[],
  secondary: EvidenceEntry[],
): EvidenceEntry[] {
  const seen = new Set(primary.map((e) => e.quote));
  const merged = [...primary];
  for (const entry of secondary) {
    if (!seen.has(entry.quote)) {
      merged.push(entry);
      seen.add(entry.quote);
    }
  }
  return merged;
}

// ── Mode detection ──────────────────────────────────────────────────

function detectMode(input: DecisionQualityAuditInput): ModeUsed {
  if (
    input.meeting_title !== undefined ||
    input.meeting_datetime !== undefined ||
    input.decision_focus !== undefined ||
    input.strategic_context !== undefined ||
    input.risk_tolerance !== undefined ||
    input.analysis_depth !== undefined ||
    (input.participant_directory !== undefined &&
      input.participant_directory.length > 0) ||
    (input.key_questions !== undefined && input.key_questions.length > 0)
  ) {
    return "transcript_plus_context";
  }
  return "transcript_only";
}

// ── Inferred fields detection ───────────────────────────────────────

function detectInferredFields(
  output: DecisionQualityAuditOutput,
  input: DecisionQualityAuditInput,
): string[] {
  const knownNames = new Set<string>();

  if (input.participant_directory) {
    for (const p of input.participant_directory) {
      knownNames.add(p.name.toLowerCase());
    }
  }

  const speakerPattern = /^([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*):/gm;
  let match: RegExpExecArray | null;
  while ((match = speakerPattern.exec(input.transcript)) !== null) {
    knownNames.add(match[1].toLowerCase());
  }

  const inferred: string[] = [];

  for (const entry of output.accountability_snapshot) {
    const ownerLower = entry.owner.toLowerCase();
    if (
      ownerLower !== "unassigned" &&
      ![...knownNames].some(
        (name) => ownerLower.includes(name) || name.includes(ownerLower),
      )
    ) {
      inferred.push(
        `accountability_snapshot: owner "${entry.owner}" not found in transcript speakers or participant_directory`,
      );
    }
  }

  const upgradeOwner = output.single_most_important_upgrade.owner.toLowerCase();
  if (
    upgradeOwner !== "unassigned" &&
    ![...knownNames].some(
      (name) => upgradeOwner.includes(name) || name.includes(upgradeOwner),
    )
  ) {
    inferred.push(
      `single_most_important_upgrade: owner "${output.single_most_important_upgrade.owner}" not found in transcript speakers or participant_directory`,
    );
  }

  return inferred;
}

// ── Main normalizer ─────────────────────────────────────────────────

export interface NormalizeResult {
  output: DecisionQualityAuditOutput;
  warnings: string[];
  inferred_fields: string[];
}

export function normalizeOutput(
  raw: unknown,
  input: DecisionQualityAuditInput,
): NormalizeResult {
  const warnings: string[] = [];
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  // Normalize gaps with deduplication
  let gaps = normalizeArray(obj.gaps, normalizeGap);
  const beforeDedup = gaps.length;
  gaps = deduplicateGaps(gaps);
  const deduped = beforeDedup - gaps.length;
  if (deduped > 0) {
    warnings.push(`${deduped} gap(s) deduplicated`);
  }

  const scoreBreakdown = normalizeScoreBreakdown(obj.score_breakdown);
  const mode = detectMode(input);

  const output: DecisionQualityAuditOutput = {
    executive_summary: asString(obj.executive_summary, ""),
    decision_surface: asString(obj.decision_surface, ""),
    decision_status: normalizeEnum(
      obj.decision_status,
      DECISION_STATUS_MAP,
      "no_decision",
    ),
    decision_quality_score: clampInt(obj.decision_quality_score, 0, 100),
    score_breakdown: scoreBreakdown,
    strengths: ensureStringArray(obj.strengths),
    gaps,
    assumptions: normalizeArray(obj.assumptions, normalizeAssumption),
    alternatives_missing: ensureStringArray(obj.alternatives_missing),
    risks_underweighted: ensureStringArray(obj.risks_underweighted),
    accountability_snapshot: normalizeArray(
      obj.accountability_snapshot,
      normalizeAccountabilityEntry,
    ),
    decision_hygiene_upgrades_next_meeting: ensureStringArray(
      obj.decision_hygiene_upgrades_next_meeting,
    ),
    single_most_important_upgrade: normalizeSingleUpgrade(
      obj.single_most_important_upgrade,
    ),
    citations: normalizeArray(obj.citations, normalizeCitation),
    metadata: {
      mode_used: mode,
      generated_at: new Date().toISOString(),
    },
  };

  const inferred_fields = detectInferredFields(output, input);

  if (inferred_fields.length > 0) {
    warnings.push(
      `${inferred_fields.length} owner(s) could not be matched to known speakers`,
    );
  }

  return { output, warnings, inferred_fields };
}
