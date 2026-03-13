import type {
  CommitmentExtractorInput,
  CommitmentExtractorOutput,
  Commitment,
  CommitmentType,
  OwnerConfidence,
  CommitmentStatus,
  Priority,
  ModeUsed,
  OwnerRollupEntry,
  SourceEvidenceEntry,
} from "./types.js";

// ── Valid enum sets ─────────────────────────────────────────────────

const COMMITMENT_TYPES = new Set<CommitmentType>([
  "deliverable", "decision", "follow_up", "coordination", "investigation",
]);
const OWNER_CONFIDENCES = new Set<OwnerConfidence>(["low", "medium", "high"]);
const STATUSES = new Set<CommitmentStatus>(["new", "carried", "unclear"]);
const PRIORITIES = new Set<Priority>(["low", "medium", "high", "critical"]);

// ── Similarity (token-set overlap) ──────────────────────────────────

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

// ── Enum clamping helpers ───────────────────────────────────────────

function clampEnum<T extends string>(
  value: unknown,
  valid: Set<T>,
  fallback: T,
): T {
  if (typeof value === "string" && valid.has(value as T)) return value as T;
  return fallback;
}

// ── Confidence heuristic ────────────────────────────────────────────

function applyConfidenceHeuristic(c: Commitment): number {
  const llm = Math.max(0, Math.min(1, c.confidence_score ?? 0));
  const hasExplicitOwner = c.owner_confidence === "high";
  const hasDueDate = typeof c.due_date_raw === "string" && c.due_date_raw.length > 0;
  const hasEvidence = Array.isArray(c.source_evidence) && c.source_evidence.length > 0;

  if (hasExplicitOwner && hasDueDate && hasEvidence) {
    return Math.max(llm, 0.85);
  }
  if (hasExplicitOwner && (!hasDueDate || !hasEvidence)) {
    return Math.max(Math.min(llm, 0.84), 0.5);
  }
  if (c.owner === "UNKNOWN" || c.owner_confidence === "low") {
    return Math.min(llm, 0.49);
  }
  return llm;
}

// ── Core normalizer ─────────────────────────────────────────────────

export interface NormalizeResult {
  output: CommitmentExtractorOutput;
  warnings: string[];
}

export function normalizeOutput(
  raw: unknown,
  input: CommitmentExtractorInput,
): NormalizeResult {
  const warnings: string[] = [];
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const rawCommitments = Array.isArray(obj.commitments) ? obj.commitments : [];

  // 1. Normalize each commitment
  let commitments: Commitment[] = rawCommitments.map((c: unknown) => {
    const item = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    return {
      id: String(item.id ?? ""),
      commitment_text: String(item.commitment_text ?? ""),
      commitment_type: clampEnum(item.commitment_type, COMMITMENT_TYPES, "follow_up"),
      owner: String(item.owner ?? "UNKNOWN"),
      owner_confidence: clampEnum(item.owner_confidence, OWNER_CONFIDENCES, "medium"),
      due_date_raw: String(item.due_date_raw ?? ""),
      due_date_normalized: String(item.due_date_normalized ?? ""),
      status: clampEnum(item.status, STATUSES, "unclear"),
      priority: clampEnum(item.priority, PRIORITIES, "medium"),
      proof_artifact_expected: String(item.proof_artifact_expected ?? ""),
      dependencies: Array.isArray(item.dependencies)
        ? item.dependencies.map(String)
        : [],
      blockers: Array.isArray(item.blockers) ? item.blockers.map(String) : [],
      source_evidence: normalizeEvidence(item.source_evidence),
      confidence_score: 0,
    };
  });

  // 2. Apply confidence heuristic (needs fields set above)
  for (const c of commitments) {
    const rawItem = rawCommitments.find(
      (r: Record<string, unknown>) => String(r.id ?? "") === c.id,
    ) as Record<string, unknown> | undefined;
    c.confidence_score = applyConfidenceHeuristic({
      ...c,
      confidence_score: Number(rawItem?.confidence_score ?? 0),
    });
  }

  // 3. Deduplicate
  const beforeDedup = commitments.length;
  commitments = deduplicateCommitments(commitments);
  const deduped = beforeDedup - commitments.length;
  if (deduped > 0) {
    warnings.push(`${deduped} commitment(s) deduplicated`);
  }

  // 4. Re-assign IDs
  commitments = commitments.map((c, i) => ({
    ...c,
    id: `CMT-${String(i + 1).padStart(3, "0")}`,
  }));

  // 5. Determine mode
  const hasContext =
    input.meeting_title !== undefined ||
    input.meeting_datetime !== undefined ||
    input.default_timezone !== undefined ||
    (input.participant_directory !== undefined && input.participant_directory.length > 0) ||
    input.focus_person !== undefined ||
    input.extraction_mode !== undefined ||
    input.include_non_actionable !== undefined;

  const modeUsed: ModeUsed = hasContext
    ? "transcript_plus_context"
    : "transcript_only";

  // 6. Rebuild owner_rollup
  const rollupMap = new Map<string, { count: number; critical_count: number }>();
  for (const c of commitments) {
    const entry = rollupMap.get(c.owner) ?? { count: 0, critical_count: 0 };
    entry.count++;
    if (c.priority === "critical") entry.critical_count++;
    rollupMap.set(c.owner, entry);
  }
  const ownerRollup: OwnerRollupEntry[] = [...rollupMap.entries()].map(
    ([owner, counts]) => ({ owner, ...counts }),
  );

  const llmRollup = Array.isArray(obj.owner_rollup) ? obj.owner_rollup : [];
  const rollupChanged =
    llmRollup.length !== ownerRollup.length ||
    ownerRollup.some((entry) => {
      const llmEntry = llmRollup.find(
        (r: Record<string, unknown>) => r.owner === entry.owner,
      ) as Record<string, unknown> | undefined;
      return (
        !llmEntry ||
        Number(llmEntry.count) !== entry.count ||
        Number(llmEntry.critical_count) !== entry.critical_count
      );
    });
  if (rollupChanged) {
    warnings.push("owner_rollup was recomputed from commitments");
  }

  // 7. Fill arrays and build output
  const unassignedActions = Array.isArray(obj.unassigned_actions)
    ? (obj.unassigned_actions as unknown[]).map(String)
    : [];

  const missingFields = Array.isArray(obj.missing_fields)
    ? (obj.missing_fields as Record<string, unknown>[]).map((mf) => ({
        commitment_id: String(mf.commitment_id ?? ""),
        missing: Array.isArray(mf.missing)
          ? (mf.missing as string[]).filter((v) =>
              ["owner", "due_date", "artifact", "scope_clarity"].includes(v),
            ) as Array<"owner" | "due_date" | "artifact" | "scope_clarity">
          : [],
        suggested_followup_question: String(
          mf.suggested_followup_question ?? "",
        ),
      }))
    : [];

  const output: CommitmentExtractorOutput = {
    summary: String(obj.summary ?? ""),
    commitments,
    unassigned_actions: unassignedActions,
    missing_fields: missingFields,
    owner_rollup: ownerRollup,
    metadata: {
      mode_used: modeUsed,
      generated_at: new Date().toISOString(),
    },
  };

  return { output, warnings };
}

// ── Helpers ─────────────────────────────────────────────────────────

function normalizeEvidence(raw: unknown): SourceEvidenceEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{ speaker: "Unknown", quote: "", approximate_location: "" }];
  }
  return raw.map((e: unknown) => {
    const entry = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    return {
      speaker: String(entry.speaker ?? "Unknown"),
      quote: String(entry.quote ?? ""),
      approximate_location: String(entry.approximate_location ?? ""),
    };
  });
}

function deduplicateCommitments(commitments: Commitment[]): Commitment[] {
  const result: Commitment[] = [];

  for (const candidate of commitments) {
    const duplicate = result.find(
      (existing) =>
        existing.owner.toLowerCase() === candidate.owner.toLowerCase() &&
        tokenOverlap(existing.commitment_text, candidate.commitment_text) > 0.8,
    );

    if (duplicate) {
      if (candidate.confidence_score > duplicate.confidence_score) {
        Object.assign(duplicate, {
          ...candidate,
          source_evidence: mergeEvidence(
            candidate.source_evidence,
            duplicate.source_evidence,
          ),
        });
      } else {
        duplicate.source_evidence = mergeEvidence(
          duplicate.source_evidence,
          candidate.source_evidence,
        );
      }
    } else {
      result.push({ ...candidate });
    }
  }

  return result;
}

function mergeEvidence(
  primary: SourceEvidenceEntry[],
  secondary: SourceEvidenceEntry[],
): SourceEvidenceEntry[] {
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
