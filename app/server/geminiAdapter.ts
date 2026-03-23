import AnthropicVertex from "@anthropic-ai/vertex-sdk";
import type { LLMClient, LLMMessage } from "../../src/wrapper/types.js";

const PROJECT_ID = process.env.GCP_PROJECT_ID || "austin-demo-490711";
const REGION = process.env.GCP_REGION || "us-east5";
export const CLAUDE_MODEL = "claude-sonnet-4-6@default";

export function createClaudeLLMClient(): LLMClient {
  return {
    async chat(messages: LLMMessage[]): Promise<string> {
      const client = new AnthropicVertex({ projectId: PROJECT_ID, region: REGION });

      const systemParts = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content);
      const userParts = messages
        .filter((m) => m.role === "user")
        .map((m) => m.content);

      const system = systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
      const userContent = userParts.join("\n\n");

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 16384,
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: userContent }],
      });

      return response.content[0].type === "text" ? response.content[0].text : "";
    },
  };
}
