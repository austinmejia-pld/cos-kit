import type { WrapperOptions, WrapperResult } from "./types.js";
import { parseCommand } from "./commandRouter.js";
import { runSkillCommand, loadConfig, resetConfig } from "./runSkillCommand.js";

let _options: WrapperOptions = {};

export function initSkillWrapper(options: WrapperOptions = {}): void {
  _options = { ...options };
  resetConfig();
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

  if (!parsed.recognized) {
    return {
      ok: false,
      mode: "error",
      content: parsed.error ?? "Unrecognized command.",
    };
  }

  return runSkillCommand(parsed, baseInput as Record<string, unknown>, {
    llmClient: _options.llmClient,
    config,
  });
}

export type { WrapperResult, WrapperOptions, LLMClient } from "./types.js";
export { parseCommand } from "./commandRouter.js";
export { formatInsight } from "./insightFormatter.js";
