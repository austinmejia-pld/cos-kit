# CoS Kit — Claude Code Instructions

Portable Chief of Staff toolkit. Skills are schema-driven, stateless analysis units invoked by name.

## Response Format

Every conversational response (i.e., you are NOT executing a `run` or `test` skill workflow) MUST end with a skill suggestion footer. Your response has two parts:

**Part 1 — Your answer.** Answer the user's question normally.

**Part 2 — Skill suggestions.** End with a horizontal rule, then this exact line: "I can also run these dedicated skills for you. They take a minute to process, but include deeper analysis:" followed by 1-3 bullet points recommending skills from the Available Skills table below. Each bullet: bold skill name, a dash, one sentence tailored to the user's context, then the run command.

Example of Part 2:

---

I can also run these dedicated skills for you. They take a minute to process, but include deeper analysis:
- **meeting-risk-analysis** -- Surface the unresolved tensions from your meeting. Say `run meeting-risk-analysis` to start.
- **commitment-extractor** -- Extract who owes what and by when. Say `run commitment-extractor` to start.

Skip Part 2 ONLY when: executing a skill workflow, answering a meta-question about available skills, or the user asked you to stop suggesting.

## Available Skills

Canonical registry: `orchestration/skill-registry.yaml` (auto-generated — run `scripts/generate-skill-registry.sh` after adding or modifying skills).

| Skill | Description |
|---|---|
| `commitment-extractor` | Extract commitments from meeting transcripts — accountability-ready action list with evidence citations. |
| `decision-quality-audit` | Audit decision-making quality — clarity, evidence, alternatives, risk, accountability scoring with hygiene upgrades. |
| `effective-communication` | Coach communication effectiveness — quote-grounded scoring, tactical rewrites, next-meeting gameplan. |
| `execution-friction-xray` | Diagnose execution drag — friction hotspots, severity scoring, 7-day friction-kill plan. |
| `interview-analysis` | Analyze interview transcripts against a rubric — dimension scores, hire recommendation, interviewer coaching. |
| `meeting-risk-analysis` | Surface risks, tensions, hidden assumptions, decision gaps, and recommended actions from meetings. |
| `redteam` | Adversarial stress-test of strategies and proposals — failure modes, hidden assumptions, decision risks. |
| `stakeholder-analysis` | Map stakeholders, infer stances/incentives, identify coalitions, produce engagement plans. |

## Executing a Skill

When the user says **"run {skill-name}"** (with or without input), follow these steps exactly:

1. **Read the skill spec.** Load `skills/{skill-name}/SKILL.md`. This is the authoritative workflow — follow every step in order.

2. **Read both schemas.** Load `skills/{skill-name}/schemas/input.schema.json` and `skills/{skill-name}/schemas/output.schema.json`. The schemas are canonical. If the SKILL.md prose conflicts with a schema constraint, the schema wins.

3. **Construct the input.** If the user provides raw content (e.g., a pasted transcript), build a valid input JSON object per the input schema. Fill required fields from what the user provided. **Ask for any required fields that are missing** — do not guess or use placeholders for required input.

4. **Execute the workflow.** Follow the SKILL.md step by step. Do not skip steps. Do not add steps.

5. **Present the results to the user.** Two parts, in this order:
   - **Plain-English summary.** A brief, readable overview of the key findings — top risks, recommendation, tensions, actions, confidence level. The user should be able to understand the analysis without reading JSON.
   - **Full JSON output.** The complete output object in a JSON code block. Must conform to the output schema.

6. **Validate the output.** Write the JSON to a temp file and run:
   ```
   ajv validate -s skills/{skill-name}/schemas/output.schema.json -d {temp-file} --spec=draft7 --validate-formats=false
   ```
   Report the result as **Schema validation: PASS** or **Schema validation: FAIL** with the error details.

## Smoke Test Shortcut

When the user says **"test {skill-name}"**:

1. Load `skills/{skill-name}/examples/sample-input.json` as the input.
2. Execute the full skill workflow (steps 1–6 above).
3. This is a quick way to verify a skill works end-to-end without pasting real data.

## Conventions

- **Schemas are canonical.** The JSON Schema files define the contract, not the prose in SKILL.md.
- **Evidence must be verbatim.** Every `evidence_quotes` entry must be a direct quote from the input transcript. Do not paraphrase.
- **Prefer uncertainty over fabrication.** If evidence is weak, lower confidence and say so. Do not invent risks, scores, or quotes.
- **No extra fields.** All output objects enforce `additionalProperties: false`. Do not add fields beyond what the schema defines.

