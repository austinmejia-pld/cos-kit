import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface RegistrySkill {
  name: string;
  description: string;
  path: string;
}

type AliasMap = Record<string, string>;

export interface SkillCommandEntry {
  skill_name: string;
  command_slug: string;
  command: string;
  description: string;
  skill_path: string;
}

export interface SkillCommandMap {
  generated_at: string;
  source_registry: string;
  source_aliases: string;
  commands: SkillCommandEntry[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

export function toSlug(skillName: string, aliases: AliasMap): string {
  return aliases[skillName] ?? skillName;
}

function normalizeQuotedValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  return trimmed;
}

export function parseSkillRegistryYaml(content: string): RegistrySkill[] {
  const lines = content.split(/\r?\n/);
  const skills: RegistrySkill[] = [];
  let current: Partial<RegistrySkill> | null = null;

  for (const line of lines) {
    const nameMatch = line.match(/^\s*-\s+name:\s+(.+)\s*$/);
    if (nameMatch) {
      if (current?.name && current.description && current.path) {
        skills.push(current as RegistrySkill);
      }
      current = { name: normalizeQuotedValue(nameMatch[1]) };
      continue;
    }

    if (!current) continue;

    const descMatch = line.match(/^\s*description:\s+(.+)\s*$/);
    if (descMatch) {
      current.description = normalizeQuotedValue(descMatch[1]);
      continue;
    }

    const pathMatch = line.match(/^\s*path:\s+(.+)\s*$/);
    if (pathMatch) {
      current.path = normalizeQuotedValue(pathMatch[1]);
      continue;
    }
  }

  if (current?.name && current.description && current.path) {
    skills.push(current as RegistrySkill);
  }

  return skills;
}

export function buildSkillCommandMap(
  skills: RegistrySkill[],
  aliases: AliasMap,
  sourceRegistry: string,
  sourceAliases: string,
): SkillCommandMap {
  const commands = skills
    .map((skill) => {
      const commandSlug = toSlug(skill.name, aliases);
      return {
        skill_name: skill.name,
        command_slug: commandSlug,
        command: `/${commandSlug}`,
        description: skill.description,
        skill_path: skill.path,
      };
    })
    .sort((a, b) => a.command.localeCompare(b.command));

  return {
    generated_at: new Date().toISOString(),
    source_registry: sourceRegistry,
    source_aliases: sourceAliases,
    commands,
  };
}

export interface CoreSyncPaths {
  registryPath: string;
  aliasPath: string;
  outputPath: string;
}

export function runCoreSync(paths: CoreSyncPaths): SkillCommandMap {
  const registryRaw = readFileSync(paths.registryPath, "utf-8");
  const aliasRaw = readFileSync(paths.aliasPath, "utf-8");

  const skills = parseSkillRegistryYaml(registryRaw);
  const aliases = JSON.parse(aliasRaw) as AliasMap;

  const map = buildSkillCommandMap(
    skills,
    aliases,
    paths.registryPath,
    paths.aliasPath,
  );

  mkdirSync(dirname(paths.outputPath), { recursive: true });
  writeFileSync(paths.outputPath, JSON.stringify(map, null, 2), "utf-8");

  return map;
}

function runCli(): void {
  const registryPath = resolve(PROJECT_ROOT, "orchestration/skill-registry.yaml");
  const aliasPath = resolve(PROJECT_ROOT, "orchestration/skill-command-aliases.json");
  const outputPath = resolve(PROJECT_ROOT, "state/skill-command-map.json");

  const map = runCoreSync({ registryPath, aliasPath, outputPath });
  process.stdout.write(
    `Generated core skill command map: ${outputPath} (${map.commands.length} command(s))\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
