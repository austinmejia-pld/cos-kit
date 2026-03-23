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

      // #region agent log
      const _responseText = response.content[0].type === "text" ? response.content[0].text : "";
      fetch('http://127.0.0.1:7654/ingest/c89b62c4-2885-43a8-aa7a-3ecf0cb77ce8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ea1298'},body:JSON.stringify({sessionId:'ea1298',location:'geminiAdapter.ts:27',message:'LLM response metadata',data:{model:CLAUDE_MODEL,max_tokens:16384,stop_reason:response.stop_reason,response_length:_responseText.length,usage:response.usage,input_tokens:response.usage?.input_tokens,output_tokens:response.usage?.output_tokens},timestamp:Date.now(),hypothesisId:'H1_H2'})}).catch(()=>{});
      // #endregion

      return _responseText;
    },
  };
}
