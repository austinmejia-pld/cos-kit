import { describe, it, expect } from "vitest";
import { parseCommand } from "../src/wrapper/commandRouter.js";

const COMMANDS: Record<string, string> = {
  "/xray": "execution-friction-xray",
  "/commitments": "commitment-extractor",
  "/stakeholders": "stakeholder-analysis",
  "/decision-audit": "decision-quality-audit",
  "/risks": "meeting-risk-analysis",
  "/redteam": "redteam",
  "/interview": "interview-analysis",
};

describe("parseCommand", () => {
  it("parses a bare known command", () => {
    const result = parseCommand("/xray", COMMANDS);
    expect(result.recognized).toBe(true);
    expect(result.command).toBe("/xray");
    expect(result.skillName).toBe("execution-friction-xray");
    expect(result.flags).toEqual({});
  });

  it("parses --raw flag", () => {
    const result = parseCommand("/commitments --raw", COMMANDS);
    expect(result.recognized).toBe(true);
    expect(result.flags.raw).toBe(true);
  });

  it("parses --focus with quoted text", () => {
    const result = parseCommand('/xray --focus "handoff risk"', COMMANDS);
    expect(result.recognized).toBe(true);
    expect(result.flags.focus).toBe("handoff risk");
  });

  it("parses --focus with unquoted text", () => {
    const result = parseCommand("/xray --focus handoffs", COMMANDS);
    expect(result.recognized).toBe(true);
    expect(result.flags.focus).toBe("handoffs");
  });

  it("parses --depth flag with valid value", () => {
    const result = parseCommand("/decision-audit --depth deep", COMMANDS);
    expect(result.recognized).toBe(true);
    expect(result.flags.depth).toBe("deep");
  });

  it("accepts all valid depth values", () => {
    for (const depth of ["quick", "standard", "deep"]) {
      const result = parseCommand(`/xray --depth ${depth}`, COMMANDS);
      expect(result.flags.depth).toBe(depth);
    }
  });

  it("parses multiple flags together", () => {
    const result = parseCommand(
      '/xray --focus "handoffs" --depth quick --raw',
      COMMANDS,
    );
    expect(result.recognized).toBe(true);
    expect(result.flags.raw).toBe(true);
    expect(result.flags.focus).toBe("handoffs");
    expect(result.flags.depth).toBe("quick");
  });

  it("returns error for unknown command", () => {
    const result = parseCommand("/unknown", COMMANDS);
    expect(result.recognized).toBe(false);
    expect(result.command).toBe("/unknown");
    expect(result.error).toContain("Unknown command: /unknown");
    expect(result.error).toContain("/xray");
  });

  it("returns error when no command found", () => {
    const result = parseCommand("just some text", COMMANDS);
    expect(result.recognized).toBe(false);
    expect(result.error).toContain("No command found");
  });

  it("ignores invalid --depth values", () => {
    const result = parseCommand("/xray --depth invalid", COMMANDS);
    expect(result.recognized).toBe(true);
    expect(result.flags.depth).toBeUndefined();
  });

  it("handles all registered commands", () => {
    for (const [cmd, skill] of Object.entries(COMMANDS)) {
      const result = parseCommand(cmd, COMMANDS);
      expect(result.recognized).toBe(true);
      expect(result.skillName).toBe(skill);
    }
  });

  it("handles leading/trailing whitespace", () => {
    const result = parseCommand("  /xray --raw  ", COMMANDS);
    expect(result.recognized).toBe(true);
    expect(result.flags.raw).toBe(true);
  });

  it("handles empty input", () => {
    const result = parseCommand("", COMMANDS);
    expect(result.recognized).toBe(false);
  });
});
