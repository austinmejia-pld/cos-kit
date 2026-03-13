export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMClient {
  chat(messages: LLMMessage[]): Promise<string>;
}

export interface CommandFlags {
  raw?: boolean;
  focus?: string;
  depth?: string;
}

export interface ParsedCommand {
  recognized: boolean;
  command?: string;
  skillName?: string;
  flags: CommandFlags;
  error?: string;
}

export interface WrapperResult {
  ok: boolean;
  mode: "insight" | "raw" | "passthrough" | "error";
  content: string;
  artifactPath?: string;
}

export interface WrapperConfig {
  enabled: boolean;
  exposeRawJsonByDefault: boolean;
  artifactDir: string;
  commands: Record<string, string>;
}

export interface WrapperOptions {
  enabled?: boolean;
  llmClient?: LLMClient;
}
