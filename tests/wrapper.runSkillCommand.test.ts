import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCommand } from "../src/wrapper/commandRouter.js";
import {
  runSkillCommand,
  resetConfig,
  type SkillRunnerResolver,
} from "../src/wrapper/runSkillCommand.js";
import type {
  LLMClient,
  WrapperConfig,
  ParsedCommand,
} from "../src/wrapper/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_ARTIFACT_DIR = ".artifacts/skill-runs-test";
const TEST_ARTIFACT_ABS = resolve(__dirname, "..", TEST_ARTIFACT_DIR);

const TEST_CONFIG: WrapperConfig = {
  enabled: true,
  exposeRawJsonByDefault: false,
  artifactDir: TEST_ARTIFACT_DIR,
  commands: {
    "/xray": "execution-friction-xray",
    "/commitments": "commitment-extractor",
    "/redteam": "redteam",
  },
};

const DISABLED_CONFIG: WrapperConfig = {
  ...TEST_CONFIG,
  enabled: false,
};

const MOCK_SKILL_DATA = {
  executive_summary: "Test summary",
  friction_score: 50,
  friction_hotspots: [],
  critical_path_risks: [],
  ambiguities_to_resolve: [],
  next_7_day_friction_kill_plan: [],
  single_highest_leverage_move: {
    move: "test",
    why: "test",
    owner: "Test",
    deadline: "tomorrow",
    success_signal: "done",
  },
  citations: [],
  metadata: { mode_used: "transcript_only", generated_at: "2026-03-12T00:00:00Z" },
};

function mockLLMClient(): LLMClient {
  return {
    chat: async () => JSON.stringify(MOCK_SKILL_DATA),
  };
}

function mockResolveRunner(
  supportedSkills: string[] = ["execution-friction-xray"],
): SkillRunnerResolver {
  return async (skillName) => {
    if (!supportedSkills.includes(skillName)) return null;
    return async () => ({
      ok: true,
      data: MOCK_SKILL_DATA,
      diagnostics: { warnings: [] },
    });
  };
}

function mockFailingRunner(): SkillRunnerResolver {
  return async () => {
    return async () => ({
      ok: false,
      error: { stage: "llm_call", message: "LLM timed out" },
    });
  };
}

function mockThrowingRunner(): SkillRunnerResolver {
  return async () => {
    return async () => {
      throw new Error("Unexpected crash");
    };
  };
}

afterEach(() => {
  resetConfig();
  if (existsSync(TEST_ARTIFACT_ABS)) {
    rmSync(TEST_ARTIFACT_ABS, { recursive: true, force: true });
  }
});

describe("runSkillCommand", () => {
  it("returns passthrough when disabled", async () => {
    const parsed = parseCommand("/xray", TEST_CONFIG.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: DISABLED_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: mockResolveRunner(),
    });
    expect(result.mode).toBe("passthrough");
    expect(result.ok).toBe(true);
  });

  it("returns error for unrecognized command", async () => {
    const parsed: ParsedCommand = {
      recognized: false,
      flags: {},
      error: "Unknown command",
    };
    const result = await runSkillCommand(parsed, {}, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
    });
    expect(result.mode).toBe("error");
    expect(result.ok).toBe(false);
  });

  it("returns error when skill has no runtime", async () => {
    const parsed = parseCommand("/redteam", TEST_CONFIG.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: mockResolveRunner([]),
    });
    expect(result.mode).toBe("error");
    expect(result.content).toContain("No runtime handler");
  });

  it("returns error when no LLM client provided", async () => {
    const parsed = parseCommand("/xray", TEST_CONFIG.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      resolveRunner: mockResolveRunner(),
    });
    expect(result.mode).toBe("error");
    expect(result.content).toContain("LLM client is required");
  });

  it("returns insight mode by default", async () => {
    const parsed = parseCommand("/xray", TEST_CONFIG.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: mockResolveRunner(),
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("insight");
    expect(result.content).toContain("## Execution Friction X-Ray");
    expect(result.content).not.toContain('"friction_hotspots"');
  });

  it("returns raw JSON with --raw flag", async () => {
    const parsed = parseCommand("/xray --raw", TEST_CONFIG.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: mockResolveRunner(),
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("raw");
    const json = JSON.parse(result.content);
    expect(json.friction_score).toBe(50);
  });

  it("returns raw JSON when exposeRawJsonByDefault is true", async () => {
    const rawConfig = { ...TEST_CONFIG, exposeRawJsonByDefault: true };
    const parsed = parseCommand("/xray", rawConfig.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: rawConfig,
      llmClient: mockLLMClient(),
      resolveRunner: mockResolveRunner(),
    });
    expect(result.mode).toBe("raw");
  });

  it("writes artifact file on successful run", async () => {
    const parsed = parseCommand("/xray", TEST_CONFIG.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: mockResolveRunner(),
    });
    expect(result.artifactPath).toBeDefined();
    expect(existsSync(result.artifactPath!)).toBe(true);
  });

  it("writes artifact file even on skill error", async () => {
    const parsed = parseCommand("/xray", TEST_CONFIG.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: mockFailingRunner(),
    });
    expect(result.ok).toBe(false);
    expect(result.mode).toBe("error");
    expect(result.artifactPath).toBeDefined();
    expect(result.content).toContain("LLM timed out");
  });

  it("handles runner that throws an exception", async () => {
    const parsed = parseCommand("/xray", TEST_CONFIG.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: mockThrowingRunner(),
    });
    expect(result.ok).toBe(false);
    expect(result.mode).toBe("error");
    expect(result.content).toContain("Unexpected crash");
  });

  it("artifact path contains skill name", async () => {
    const parsed = parseCommand("/xray", TEST_CONFIG.commands);
    const result = await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: mockResolveRunner(),
    });
    expect(result.artifactPath).toContain("execution-friction-xray");
  });
});

describe("flag mapping", () => {
  it("maps --focus to skill-specific input field", async () => {
    let capturedInput: unknown;
    const capturingResolver: SkillRunnerResolver = async () => {
      return async (input) => {
        capturedInput = input;
        return { ok: true, data: MOCK_SKILL_DATA };
      };
    };

    const parsed = parseCommand(
      '/xray --focus "handoff risk"',
      TEST_CONFIG.commands,
    );
    await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: capturingResolver,
    });

    expect((capturedInput as Record<string, unknown>).focus_area).toBe(
      "handoff risk",
    );
  });

  it("maps --depth to analysis_depth", async () => {
    let capturedInput: unknown;
    const capturingResolver: SkillRunnerResolver = async () => {
      return async (input) => {
        capturedInput = input;
        return { ok: true, data: MOCK_SKILL_DATA };
      };
    };

    const parsed = parseCommand("/xray --depth deep", TEST_CONFIG.commands);
    await runSkillCommand(parsed, { transcript: "hello" }, {
      config: TEST_CONFIG,
      llmClient: mockLLMClient(),
      resolveRunner: capturingResolver,
    });

    expect((capturedInput as Record<string, unknown>).analysis_depth).toBe(
      "deep",
    );
  });

  it("preserves baseInput fields alongside flags", async () => {
    let capturedInput: unknown;
    const capturingResolver: SkillRunnerResolver = async () => {
      return async (input) => {
        capturedInput = input;
        return { ok: true, data: MOCK_SKILL_DATA };
      };
    };

    const parsed = parseCommand("/xray --focus test", TEST_CONFIG.commands);
    await runSkillCommand(
      parsed,
      { transcript: "hello", meeting_title: "standup" },
      {
        config: TEST_CONFIG,
        llmClient: mockLLMClient(),
        resolveRunner: capturingResolver,
      },
    );

    const input = capturedInput as Record<string, unknown>;
    expect(input.transcript).toBe("hello");
    expect(input.meeting_title).toBe("standup");
    expect(input.focus_area).toBe("test");
  });
});
