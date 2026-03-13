import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillCommandMap } from "./sync-skill-commands-core.ts";

interface WrapperConfig {
  enabled: boolean;
  exposeRawJsonByDefault: boolean;
  artifactDir: string;
  commands: Record<string, string>;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const GENERATED_MARKER = "<!-- GENERATED: sync-claude-commands -->";

function yamlDoubleQuoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function renderClaudeCommand(entry: SkillCommandMap["commands"][number]): string {
  return `---
description: ${yamlDoubleQuoted(entry.description)}
---

${GENERATED_MARKER}

Run the \`${entry.skill_name}\` skill.

Interpret any provided arguments as optional command hints, then execute the skill workflow defined in \`CLAUDE.md\` and \`${entry.skill_path}\`.

Arguments: $ARGUMENTS
`;
}

function loadExistingWrapperConfig(path: string): Partial<WrapperConfig> {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf-8")) as Partial<WrapperConfig>;
}

function buildWrapperConfig(
  map: SkillCommandMap,
  existing: Partial<WrapperConfig>,
): WrapperConfig {
  const commands: Record<string, string> = {};
  for (const entry of map.commands) {
    commands[entry.command] = entry.skill_name;
  }

  return {
    enabled: existing.enabled ?? true,
    exposeRawJsonByDefault: existing.exposeRawJsonByDefault ?? false,
    artifactDir: existing.artifactDir ?? ".artifacts/skill-runs",
    commands,
  };
}

export interface ClaudeSyncPaths {
  mapPath: string;
  wrapperConfigPath: string;
  claudeCommandsDir: string;
}

export function runClaudeSync(paths: ClaudeSyncPaths): {
  configPath: string;
  commandsDir: string;
  commandCount: number;
} {
  const map = JSON.parse(readFileSync(paths.mapPath, "utf-8")) as SkillCommandMap;

  const existing = loadExistingWrapperConfig(paths.wrapperConfigPath);
  const config = buildWrapperConfig(map, existing);
  mkdirSync(dirname(paths.wrapperConfigPath), { recursive: true });
  writeFileSync(paths.wrapperConfigPath, JSON.stringify(config, null, 2), "utf-8");

  mkdirSync(paths.claudeCommandsDir, { recursive: true });
  const targetFiles = new Set<string>();

  for (const entry of map.commands) {
    const filename = `${entry.command_slug}.md`;
    const filePath = resolve(paths.claudeCommandsDir, filename);
    targetFiles.add(filename);
    writeFileSync(filePath, renderClaudeCommand(entry), "utf-8");
  }

  for (const filename of readdirSync(paths.claudeCommandsDir)) {
    if (!filename.endsWith(".md")) continue;
    if (targetFiles.has(filename)) continue;

    const filePath = resolve(paths.claudeCommandsDir, filename);
    const content = readFileSync(filePath, "utf-8");
    if (content.includes(GENERATED_MARKER)) {
      rmSync(filePath, { force: true });
    }
  }

  return {
    configPath: paths.wrapperConfigPath,
    commandsDir: paths.claudeCommandsDir,
    commandCount: map.commands.length,
  };
}

function runCli(): void {
  const mapPath = resolve(PROJECT_ROOT, "state/skill-command-map.json");
  const wrapperConfigPath = resolve(PROJECT_ROOT, "config/skill-wrapper.config.json");
  const claudeCommandsDir = resolve(PROJECT_ROOT, ".claude/commands");
  const result = runClaudeSync({ mapPath, wrapperConfigPath, claudeCommandsDir });

  process.stdout.write(
    `Synced Claude commands: ${result.commandsDir} (${result.commandCount} command(s)); config: ${basename(result.configPath)}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
