import type { WrapperOptions, WrapperResult } from "./types.js";
import type { RouterInput } from "./routerTypes.js";
import { parseCommand } from "./commandRouter.js";
import { runSkillCommand, loadConfig, resetConfig } from "./runSkillCommand.js";
import { loadSkillCatalog, resetCache as resetCatalogCache } from "./skillIndex.js";
import { routeSkill, formatSuggestion } from "./skillRouter.js";

let _options: WrapperOptions = {};

export function initSkillWrapper(options: WrapperOptions = {}): void {
  _options = { ...options };
  resetConfig();
  resetCatalogCache();
}

export async function handleWrappedCommand(
  inputText: string,
  baseInput: object,
): Promise<WrapperResult> {
  const config = loadConfig();

  if (_options.enabled === false || !config.enabled) {
    return {
      ok: true,
      mode: "passthrough",
      content: "Skill wrapper is disabled.",
    };
  }

  const parsed = parseCommand(inputText, config.commands);

  if (parsed.recognized) {
    return runSkillCommand(parsed, baseInput as Record<string, unknown>, {
      llmClient: _options.llmClient,
      config,
    });
  }

  // Router: suggest a skill when no slash command was used
  if (config.routerEnabled !== false && inputText.trim().length > 0) {
    try {
      const catalog = loadSkillCatalog();
      if (catalog.length > 0) {
        const routerInput: RouterInput = {
          userMessage: inputText,
          availableInputs: Object.keys(baseInput),
        };
        const decision = await routeSkill(
          routerInput,
          catalog,
          _options.llmClient,
          config.routerLLMEscalation === true,
        );

        if (decision.decision !== "NO_SKILL") {
          const suggestion = formatSuggestion(decision, catalog);
          if (suggestion) {
            return { ok: true, mode: "insight", content: suggestion };
          }
        }
      }
    } catch {
      // Router failure — fall through to error (never blocks)
    }
  }

  return {
    ok: false,
    mode: "error",
    content: parsed.error ?? "Unrecognized command.",
  };
}

export type { WrapperResult, WrapperOptions, LLMClient } from "./types.js";
export type {
  RouterInput,
  RouterDecision,
  ScoredSkill,
  SkillMeta,
  DecisionType,
} from "./routerTypes.js";
export { parseCommand } from "./commandRouter.js";
export { formatInsight } from "./insightFormatter.js";
export { routeSkill, formatSuggestion } from "./skillRouter.js";
export { loadSkillCatalog } from "./skillIndex.js";
