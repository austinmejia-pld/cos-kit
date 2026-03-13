import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  buildSkillCommandMap,
  parseSkillRegistryYaml,
  runCoreSync,
} from "../scripts/sync-skill-commands-core.ts";

describe("sync-skill-commands-core", () => {
  it("parses skill registry yaml entries", () => {
    const yaml = `
generated_at: "2026-03-13T00:00:00Z"
skills:
  - name: "execution-friction-xray"
    description: "xray skill"
    path: "skills/execution-friction-xray/SKILL.md"
  - name: "redteam"
    description: "redteam skill"
    path: "skills/redteam/SKILL.md"
`;
    const parsed = parseSkillRegistryYaml(yaml);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("execution-friction-xray");
    expect(parsed[1].path).toBe("skills/redteam/SKILL.md");
  });

  it("applies alias overrides and default slug fallback", () => {
    const map = buildSkillCommandMap(
      [
        {
          name: "execution-friction-xray",
          description: "xray",
          path: "skills/execution-friction-xray/SKILL.md",
        },
        {
          name: "new-skill",
          description: "new",
          path: "skills/new-skill/SKILL.md",
        },
      ],
      { "execution-friction-xray": "xray" },
      "registry.yaml",
      "aliases.json",
    );

    const xray = map.commands.find((c) => c.skill_name === "execution-friction-xray");
    const newSkill = map.commands.find((c) => c.skill_name === "new-skill");
    expect(xray?.command).toBe("/xray");
    expect(newSkill?.command).toBe("/new-skill");
  });

  it("writes canonical map artifact and remains IDE-agnostic", () => {
    const root = mkdtempSync(resolve(tmpdir(), "skill-core-sync-"));
    try {
      const registryPath = resolve(root, "skill-registry.yaml");
      const aliasPath = resolve(root, "aliases.json");
      const outputPath = resolve(root, "state/skill-command-map.json");

      writeFileSync(
        registryPath,
        `
skills:
  - name: "redteam"
    description: "redteam skill"
    path: "skills/redteam/SKILL.md"
`,
        "utf-8",
      );
      writeFileSync(aliasPath, JSON.stringify({}, null, 2), "utf-8");

      const map = runCoreSync({ registryPath, aliasPath, outputPath });
      expect(map.commands).toHaveLength(1);

      const written = JSON.parse(readFileSync(outputPath, "utf-8")) as {
        commands: Array<{ command: string }>;
      };
      expect(written.commands[0].command).toBe("/redteam");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
