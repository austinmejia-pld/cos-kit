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
  // #region agent log
  fetch("http://127.0.0.1:7848/ingest/394e6945-2750-434f-bb8d-31c4f129abe1",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"6491c8"},body:JSON.stringify({sessionId:"6491c8",runId:"cmd-ui-check",hypothesisId:"H2",location:"src/wrapper/index.ts:16",message:"handleWrappedCommand invoked",data:{inputTextPreview:inputText.slice(0,80),baseInputKeys:Object.keys(baseInput ?? {})},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const config = loadConfig();

  if (_options.enabled === false || !config.enabled) {
    return {
      ok: true,
      mode: "passthrough",
      content: "Skill wrapper is disabled.",
    };
  }

  const parsed = parseCommand(inputText, config.commands);
  // #region agent log
  fetch("http://127.0.0.1:7848/ingest/394e6945-2750-434f-bb8d-31c4f129abe1",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"6491c8"},body:JSON.stringify({sessionId:"6491c8",runId:"cmd-ui-check",hypothesisId:"H3",location:"src/wrapper/index.ts:29",message:"parseCommand result",data:{recognized:parsed.recognized,command:parsed.command ?? null,skillName:parsed.skillName ?? null,error:parsed.error ?? null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

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
