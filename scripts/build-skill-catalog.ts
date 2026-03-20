/**
 * Build the skill catalog JSON from skill-registry.yaml, routes.yaml,
 * and skill-command-aliases.json. The output is consumed by the
 * skill router at runtime.
 *
 * Usage: tsx scripts/build-skill-catalog.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSkillRegistryYaml } from "./sync-skill-commands-core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

interface RouteEntry {
  id: string;
  status: string;
  triggerExamples: string[];
  requiredInputs: string[];
  fallbackPrompt: string;
}

interface CatalogEntry {
  id: string;
  description: string;
  command: string;
  status: "active" | "planned";
  triggerExamples: string[];
  requiredInputs: string[];
  fallbackPrompt: string;
}

// ── Simple routes.yaml parser ───────────────────────────────────────

function parseRoutesYaml(content: string): RouteEntry[] {
  const routes: RouteEntry[] = [];
  let current: Partial<RouteEntry> | null = null;
  let collectingTriggers = false;
  let collectingInputs = false;
  let collectingFallback = false;
  let fallbackLines: string[] = [];

  for (const line of content.split(/\r?\n/)) {
    // New route entry
    const idMatch = line.match(/^\s*-\s+id:\s+(.+)\s*$/);
    if (idMatch) {
      if (current?.id) {
        if (fallbackLines.length > 0) {
          current.fallbackPrompt = fallbackLines.join(" ").trim();
        }
        routes.push(current as RouteEntry);
      }
      current = {
        id: idMatch[1].trim(),
        triggerExamples: [],
        requiredInputs: [],
        fallbackPrompt: "",
      };
      collectingTriggers = false;
      collectingInputs = false;
      collectingFallback = false;
      fallbackLines = [];
      continue;
    }

    if (!current) continue;

    // Status
    const statusMatch = line.match(/^\s+status:\s+(.+)\s*$/);
    if (statusMatch) {
      current.status = statusMatch[1].trim();
      collectingTriggers = false;
      collectingInputs = false;
      collectingFallback = false;
      continue;
    }

    // trigger_examples header
    if (/^\s+trigger_examples:\s*$/.test(line)) {
      collectingTriggers = true;
      collectingInputs = false;
      collectingFallback = false;
      continue;
    }

    // required_inputs header
    if (/^\s+required_inputs:\s*$/.test(line)) {
      collectingTriggers = false;
      collectingInputs = true;
      collectingFallback = false;
      continue;
    }

    // fallback_prompt header
    if (/^\s+fallback_prompt:\s*>?\s*$/.test(line)) {
      collectingTriggers = false;
      collectingInputs = false;
      collectingFallback = true;
      fallbackLines = [];
      continue;
    }

    // Other keyed fields end collection
    if (/^\s+\w[\w_]*:/.test(line) && !line.match(/^\s+-/)) {
      collectingTriggers = false;
      collectingInputs = false;
      if (collectingFallback) {
        current.fallbackPrompt = fallbackLines.join(" ").trim();
        collectingFallback = false;
      }
      continue;
    }

    // Collect list items
    const listItemMatch = line.match(/^\s+-\s+"?([^"]*)"?\s*$/);
    if (listItemMatch) {
      if (collectingTriggers) {
        current.triggerExamples!.push(listItemMatch[1].trim());
      } else if (collectingInputs) {
        current.requiredInputs!.push(listItemMatch[1].trim());
      }
      continue;
    }

    // Collect fallback continuation lines
    if (collectingFallback && line.trim().length > 0) {
      fallbackLines.push(line.trim());
    }
  }

  // Flush last entry
  if (current?.id) {
    if (fallbackLines.length > 0) {
      current.fallbackPrompt = fallbackLines.join(" ").trim();
    }
    routes.push(current as RouteEntry);
  }

  return routes;
}

// ── Main ────────────────────────────────────────────────────────────

function main(): void {
  const registryPath = resolve(PROJECT_ROOT, "orchestration/skill-registry.yaml");
  const routesPath = resolve(PROJECT_ROOT, "orchestration/routes.yaml");
  const aliasPath = resolve(PROJECT_ROOT, "orchestration/skill-command-aliases.json");
  const outputPath = resolve(PROJECT_ROOT, "config/skill-catalog.json");

  // Parse sources
  const registryRaw = readFileSync(registryPath, "utf-8");
  const skills = parseSkillRegistryYaml(registryRaw);

  const routesRaw = readFileSync(routesPath, "utf-8");
  const routes = parseRoutesYaml(routesRaw);
  const routeMap = new Map(routes.map((r) => [r.id, r]));

  const aliases: Record<string, string> = JSON.parse(
    readFileSync(aliasPath, "utf-8"),
  );
  // Invert: alias value → "/" + alias key
  const commandMap = new Map<string, string>();
  for (const [skill, alias] of Object.entries(aliases)) {
    commandMap.set(skill, `/${alias}`);
  }

  // Merge: registry descriptions + route trigger data
  const catalog: CatalogEntry[] = skills.map((skill) => {
    const route = routeMap.get(skill.name);
    return {
      id: skill.name,
      description: skill.description,
      command: commandMap.get(skill.name) ?? `/${skill.name}`,
      status: (route?.status as "active" | "planned") ?? "active",
      triggerExamples: route?.triggerExamples ?? [],
      requiredInputs: route?.requiredInputs ?? [],
      fallbackPrompt: route?.fallbackPrompt ?? "",
    };
  });

  // Also include routes that aren't in the registry (planned skills)
  for (const route of routes) {
    if (!skills.some((s) => s.name === route.id)) {
      catalog.push({
        id: route.id,
        description: "",
        command: commandMap.get(route.id) ?? `/${route.id}`,
        status: (route.status as "active" | "planned") ?? "planned",
        triggerExamples: route.triggerExamples,
        requiredInputs: route.requiredInputs,
        fallbackPrompt: route.fallbackPrompt,
      });
    }
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  const output = {
    generated_at: new Date().toISOString(),
    skills: catalog,
  };
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n", "utf-8");

  process.stdout.write(
    `Generated skill catalog: ${outputPath} (${catalog.length} skill(s))\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
