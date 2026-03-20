import type { LLMClient } from "./types.js";

/**
 * Two-pass repair: given a malformed or schema-invalid LLM response,
 * build a repair prompt that includes the original response and the
 * specific validation errors, then ask the LLM to fix only the errors.
 */
export async function repairOutput(
  originalResponse: string,
  validationErrors: Array<{ path: string; message: string; keyword: string }>,
  client: LLMClient,
  systemPrompt: string,
): Promise<{ data: unknown; error?: string }> {
  const errorList = validationErrors
    .map((e) => `- ${e.path}: ${e.message} (${e.keyword})`)
    .join("\n");

  const repairPrompt = [
    "The following JSON output failed schema validation. Fix ONLY the errors listed below and return the corrected JSON.",
    "Do NOT change any content that is already valid. Do NOT add markdown fences or text outside the JSON.",
    "",
    "## Validation Errors",
    "",
    errorList,
    "",
    "## Original Response",
    "",
    originalResponse,
  ].join("\n");

  let repairResponse: string;
  try {
    repairResponse = await client.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: repairPrompt },
    ]);
  } catch (err) {
    return {
      data: null,
      error: `Repair LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return parseJsonSafely(repairResponse);
}

function parseJsonSafely(text: string): { data: unknown; error?: string } {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?\s*```$/, "");
  cleaned = cleaned.trim();

  try {
    return { data: JSON.parse(cleaned) };
  } catch {
    return {
      data: null,
      error: `Repair returned invalid JSON: ${cleaned.slice(0, 120)}…`,
    };
  }
}
