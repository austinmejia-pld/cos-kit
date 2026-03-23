/**
 * Skill index — loads the generated skill catalog and derives
 * keyword / anti-keyword sets for v0 routing.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillMeta } from "./routerTypes.js";
import { tokenize } from "./textUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, "../../config/skill-catalog.json");

interface CatalogFile {
  generated_at: string;
  skills: Array<{
    id: string;
    label?: string;
    description: string;
    command: string;
    status: "active" | "planned";
    triggerExamples: string[];
    signalPhrases?: string[];
    requiredInputs: string[];
    fallbackPrompt: string;
  }>;
}

let _cache: { skills: SkillMeta[]; loadedAt: number } | null = null;
let _cacheTTL = 60_000; // default 60s

export function setCacheTTL(ms: number): void {
  _cacheTTL = ms;
}

export function resetCache(): void {
  _cache = null;
}

/**
 * Load the skill catalog from disk and derive keywords/anti-keywords.
 * Results are cached with a configurable TTL.
 */
export function loadSkillCatalog(catalogPath?: string): SkillMeta[] {
  const now = Date.now();
  if (_cache && now - _cache.loadedAt < _cacheTTL) {
    return _cache.skills;
  }

  const path = catalogPath ?? CATALOG_PATH;
  let catalog: CatalogFile;

  try {
    catalog = JSON.parse(readFileSync(path, "utf-8")) as CatalogFile;
  } catch {
    // Catalog missing or corrupt — return empty (graceful degradation)
    return [];
  }

  const skills = buildIndex(catalog.skills);
  _cache = { skills, loadedAt: now };
  return skills;
}

/**
 * Derive keywords and anti-keywords for each skill.
 * Exported for testing.
 */
export function buildIndex(
  entries: CatalogFile["skills"],
): SkillMeta[] {
  // Step 1: derive keyword sets per skill
  const skillKeywords = entries.map((entry) => {
    const text = [
      entry.description,
      ...entry.triggerExamples,
    ].join(" ");
    return {
      entry,
      keywords: tokenize(text),
    };
  });

  // Step 2: for each skill, anti-keywords = keywords that appear
  // in other skills but NOT in this skill
  const allKeywordSets = skillKeywords.map((s) => new Set(s.keywords));

  return skillKeywords.map((skill, i) => {
    const myKeywords = allKeywordSets[i];
    const antiKeywords: string[] = [];

    for (let j = 0; j < skillKeywords.length; j++) {
      if (j === i) continue;
      for (const kw of skillKeywords[j].keywords) {
        if (!myKeywords.has(kw) && !antiKeywords.includes(kw)) {
          antiKeywords.push(kw);
        }
      }
    }

    return {
      id: skill.entry.id,
      label: skill.entry.label,
      description: skill.entry.description,
      command: skill.entry.command,
      status: skill.entry.status,
      triggerExamples: skill.entry.triggerExamples,
      signalPhrases: skill.entry.signalPhrases ?? [],
      requiredInputs: skill.entry.requiredInputs,
      fallbackPrompt: skill.entry.fallbackPrompt,
      keywords: skill.keywords,
      antiKeywords,
    };
  });
}
