import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runStakeholderAnalysis } from "../../src/skills/stakeholder-analysis/index.js";
import { runAssertions, type CaseExpect } from "./assertions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const casesDir = join(__dirname, "cases");

interface CaseFile {
  id: string;
  description: string;
  input: unknown;
  model_response: unknown;
  expect: CaseExpect;
}

function loadCases(): CaseFile[] {
  const files = readdirSync(casesDir).filter((f) => f.endsWith(".case.json"));
  return files.map((f) => {
    const raw = readFileSync(join(casesDir, f), "utf-8");
    return JSON.parse(raw) as CaseFile;
  });
}

async function main() {
  const cases = loadCases();

  if (cases.length === 0) {
    console.error("No case files found in", casesDir);
    process.exit(1);
  }

  let totalPassed = 0;
  let totalAssertions = 0;
  let anyFailed = false;

  for (const c of cases) {
    console.log(`\n── Case: ${c.id} ──`);
    console.log(`   ${c.description}\n`);

    const llmJson = JSON.stringify(c.model_response);
    const result = await runStakeholderAnalysis(c.input, llmJson);
    const assertions = runAssertions(result, c.expect);

    for (const a of assertions) {
      const tag = a.passed ? "\x1b[32m[PASS]\x1b[0m" : "\x1b[31m[FAIL]\x1b[0m";
      console.log(`${tag} ${c.id}: ${a.name} (${a.detail})`);
      if (a.passed) totalPassed++;
      else anyFailed = true;
      totalAssertions++;
    }
  }

  const pct = totalAssertions > 0 ? Math.round((totalPassed / totalAssertions) * 100) : 0;
  console.log(`\n════════════════════════════════════`);
  console.log(`Score: ${totalPassed}/${totalAssertions} (${pct}%)`);
  console.log(`════════════════════════════════════\n`);

  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error running evals:", err);
  process.exit(1);
});
