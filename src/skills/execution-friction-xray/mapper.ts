import type {
  ExecutionFrictionXrayInput,
  ExecutionFrictionXrayOutput,
  FrictionCategory,
  BlastRadius,
  ModeUsed,
  FrictionHotspot,
  EvidenceEntry,
  CriticalPathRisk,
  Ambiguity,
  KillPlanAction,
  HighestLeverageMove,
  Citation,
} from "./types.js";

// ── Enum normalization maps ─────────────────────────────────────────

const CATEGORY_MAP: Record<string, FrictionCategory> = {
  ownership: "ownership",
  owner: "ownership",
  unowned: "ownership",
  dependency: "dependency",
  dep: "dependency",
  dependencies: "dependency",
  blocked: "dependency",
  timeline: "timeline",
  time: "timeline",
  deadline: "timeline",
  schedule: "timeline",
  scope: "scope",
  scope_creep: "scope",
  requirements: "scope",
  decision_latency: "decision_latency",
  decision: "decision_latency",
  latency: "decision_latency",
  deferred: "decision_latency",
  handoff: "handoff",
  handover: "handoff",
  hand_off: "handoff",
  transition: "handoff",
  resourcing: "resourcing",
  resource: "resourcing",
  staffing: "resourcing",
  bandwidth: "resourcing",
  capacity: "resourcing",
  signal_noise: "signal_noise",
  noise: "signal_noise",
  signal: "signal_noise",
  clarity: "signal_noise",
};

const BLAST_RADIUS_MAP: Record<string, BlastRadius> = {
  local: "local",
  team: "local",
  single_team: "local",
  cross_team: "cross_team",
  "cross-team": "cross_team",
  crossteam: "cross_team",
  multi_team: "cross_team",
  org_wide: "org_wide",
  "org-wide": "org_wide",
  orgwide: "org_wide",
  org: "org_wide",
  organization: "org_wide",
  company: "org_wide",
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

function normalizeHotspot(raw: Record<string, unknown>): FrictionHotspot {
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
    id: asString(raw.id, ""),
    category: normalizeEnum(raw.category, CATEGORY_MAP, "ownership"),
    title: asString(raw.title, "Untitled hotspot"),
    why_it_creates_drag: asString(raw.why_it_creates_drag, ""),
    severity: clampInt(raw.severity, 1, 5),
    likelihood: clampInt(raw.likelihood, 1, 5),
    blast_radius: normalizeEnum(raw.blast_radius, BLAST_RADIUS_MAP, "local"),
    early_warning_signals: ensureStringArray(raw.early_warning_signals),
    evidence,
    recommended_fix: asString(raw.recommended_fix, ""),
    owner_recommendation: asString(raw.owner_recommendation, "Unassigned"),
    target_resolution_window: asString(raw.target_resolution_window, ""),
  };
}

function normalizeCriticalPathRisk(
  raw: Record<string, unknown>,
): CriticalPathRisk {
  return {
    risk: asString(raw.risk, ""),
    blocking_dependency: asString(raw.blocking_dependency, ""),
    owner: asString(raw.owner, "Unassigned"),
    due_or_trigger: asString(raw.due_or_trigger, ""),
    unblock_action: asString(raw.unblock_action, ""),
  };
}

function normalizeAmbiguity(raw: Record<string, unknown>): Ambiguity {
  return {
    ambiguity: asString(raw.ambiguity, ""),
    why_it_matters: asString(raw.why_it_matters, ""),
    proposed_clarifying_question: asString(
      raw.proposed_clarifying_question,
      "",
    ),
  };
}

function normalizeKillPlanAction(
  raw: Record<string, unknown>,
): KillPlanAction {
  return {
    action: asString(raw.action, ""),
    owner: asString(raw.owner, "Unassigned"),
    due: asString(raw.due, ""),
    proof_artifact: asString(raw.proof_artifact, ""),
  };
}

function normalizeHighestLeverageMove(
  raw: unknown,
): HighestLeverageMove {
  const obj = (typeof raw === "object" && raw !== null
    ? raw
    : {}) as Record<string, unknown>;
  return {
    move: asString(obj.move, ""),
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

// ── Deduplication ───────────────────────────────────────────────────

function deduplicateHotspots(hotspots: FrictionHotspot[]): FrictionHotspot[] {
  const result: FrictionHotspot[] = [];

  for (const candidate of hotspots) {
    const duplicate = result.find(
      (existing) => tokenOverlap(existing.title, candidate.title) > 0.8,
    );

    if (duplicate) {
      if (candidate.severity > duplicate.severity) {
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

function detectMode(input: ExecutionFrictionXrayInput): ModeUsed {
  if (
    input.meeting_title !== undefined ||
    input.meeting_datetime !== undefined ||
    input.team_context !== undefined ||
    input.focus_area !== undefined ||
    input.urgency_level !== undefined ||
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
  hotspots: FrictionHotspot[],
  input: ExecutionFrictionXrayInput,
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
  for (const h of hotspots) {
    const ownerLower = h.owner_recommendation.toLowerCase();
    if (
      ownerLower !== "unassigned" &&
      ![...knownNames].some(
        (name) => ownerLower.includes(name) || name.includes(ownerLower),
      )
    ) {
      inferred.push(
        `${h.id}: owner_recommendation "${h.owner_recommendation}" not found in transcript speakers or participant_directory`,
      );
    }
  }

  return inferred;
}

// ── Main normalizer ─────────────────────────────────────────────────

export interface NormalizeResult {
  output: ExecutionFrictionXrayOutput;
  warnings: string[];
  inferred_fields: string[];
}

export function normalizeOutput(
  raw: unknown,
  input: ExecutionFrictionXrayInput,
): NormalizeResult {
  const warnings: string[] = [];
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;

  // Normalize hotspots
  let hotspots = normalizeArray(obj.friction_hotspots, normalizeHotspot);
  const beforeDedup = hotspots.length;
  hotspots = deduplicateHotspots(hotspots);
  const deduped = beforeDedup - hotspots.length;
  if (deduped > 0) {
    warnings.push(`${deduped} hotspot(s) deduplicated`);
  }

  // Re-assign IDs
  hotspots = hotspots.map((h, i) => ({
    ...h,
    id: `FH-${String(i + 1).padStart(3, "0")}`,
  }));

  const mode = detectMode(input);
  const inferred_fields = detectInferredFields(hotspots, input);

  if (inferred_fields.length > 0) {
    warnings.push(
      `${inferred_fields.length} owner recommendation(s) could not be matched to known speakers`,
    );
  }

  const output: ExecutionFrictionXrayOutput = {
    executive_summary: asString(obj.executive_summary, ""),
    friction_score: clampInt(obj.friction_score, 0, 100),
    friction_hotspots: hotspots,
    critical_path_risks: normalizeArray(
      obj.critical_path_risks,
      normalizeCriticalPathRisk,
    ),
    ambiguities_to_resolve: normalizeArray(
      obj.ambiguities_to_resolve,
      normalizeAmbiguity,
    ),
    next_7_day_friction_kill_plan: normalizeArray(
      obj.next_7_day_friction_kill_plan,
      normalizeKillPlanAction,
    ),
    single_highest_leverage_move: normalizeHighestLeverageMove(
      obj.single_highest_leverage_move,
    ),
    citations: normalizeArray(obj.citations, normalizeCitation),
    metadata: {
      mode_used: mode,
      generated_at: new Date().toISOString(),
    },
  };

  return { output, warnings, inferred_fields };
}
