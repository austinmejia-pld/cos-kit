import { describe, it, expect } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { runClaudeSync } from "../scripts/sync-claude-commands.ts";

describe("sync-claude-commands adapter", () => {
  it("generates wrapper config + command files and preserves manual files", () => {
    const root = mkdtempSync(resolve(tmpdir(), "claude-adapter-sync-"));
    try {
      const mapPath = resolve(root, "state/skill-command-map.json");
      const wrapperConfigPath = resolve(root, "config/skill-wrapper.config.json");
      const claudeCommandsDir = resolve(root, ".claude/commands");
      mkdirSync(resolve(root, "state"), { recursive: true });
      mkdirSync(resolve(root, "config"), { recursive: true });
      mkdirSync(claudeCommandsDir, { recursive: true });

      writeFileSync(
        mapPath,
        JSON.stringify(
          {
            generated_at: "2026-03-13T00:00:00Z",
            source_registry: "registry.yaml",
            source_aliases: "aliases.json",
            commands: [
              {
                skill_name: "execution-friction-xray",
                command_slug: "xray",
                command: "/xray",
                description:
                  "Diagnose execution drag from a single meeting transcript by identifying friction hotspots.",
                skill_path: "skills/execution-friction-xray/SKILL.md",
              },
              {
                skill_name: "redteam",
                command_slug: "redteam",
                command: "/redteam",
                description:
                  "Adversarial analysis of a meeting transcript to surface failure modes and risks.",
                skill_path: "skills/redteam/SKILL.md",
              },
            ],
          },
          null,
          2,
        ),
        "utf-8",
      );

      writeFileSync(
        wrapperConfigPath,
        JSON.stringify(
          {
            enabled: false,
            exposeRawJsonByDefault: true,
            artifactDir: ".custom-artifacts",
            commands: {},
          },
          null,
          2,
        ),
        "utf-8",
      );

      writeFileSync(
        resolve(claudeCommandsDir, "manual.md"),
        "---\ndescription: manual\n---\nmanual",
        "utf-8",
      );
      writeFileSync(
        resolve(claudeCommandsDir, "stale.md"),
        "---\ndescription: stale\n---\n\n<!-- GENERATED: sync-claude-commands -->\nstale",
        "utf-8",
      );

      runClaudeSync({ mapPath, wrapperConfigPath, claudeCommandsDir });

      const config = JSON.parse(readFileSync(wrapperConfigPath, "utf-8")) as {
        enabled: boolean;
        exposeRawJsonByDefault: boolean;
        artifactDir: string;
        commands: Record<string, string>;
      };
      expect(config.enabled).toBe(false);
      expect(config.exposeRawJsonByDefault).toBe(true);
      expect(config.artifactDir).toBe(".custom-artifacts");
      expect(config.commands).toEqual({
        "/xray": "execution-friction-xray",
        "/redteam": "redteam",
      });

      const xrayFile = readFileSync(resolve(claudeCommandsDir, "xray.md"), "utf-8");
      expect(xrayFile).toContain("<!-- GENERATED: sync-claude-commands -->");
      expect(xrayFile).toContain("Run the `execution-friction-xray` skill.");
      expect(xrayFile).toContain(
        'description: "Diagnose execution drag from a single meeting transcript by identifying friction hotspots."',
      );
      expect(xrayFile).not.toContain("description: Run execution-friction-xray skill");

      expect(existsSync(resolve(claudeCommandsDir, "manual.md"))).toBe(true);
      expect(existsSync(resolve(claudeCommandsDir, "stale.md"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
