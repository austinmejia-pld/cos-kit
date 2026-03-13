# CoS Kit — Claude Code Instructions

Portable Chief of Staff toolkit. Skills are schema-driven, stateless analysis units invoked by name.

## Available Skills

Canonical registry: `orchestration/skill-registry.yaml`

| Skill | Description |
|---|---|
| `interview-analysis` | Analyze an interview transcript against a role rubric to produce evidence-backed dimension scores, a hire recommendation, and interviewer coaching feedback. |
| `meeting-risk-analysis` | Analyze a meeting transcript to surface risks, unresolved tensions, hidden assumptions, decision gaps, and recommended actions with evidence-backed citations. |
| `redteam` | Adversarial analysis of a meeting transcript to surface failure modes, hidden assumptions, and decision risks. Two modes: transcript-only (broad scan) or transcript + focus (targeted stress-test of a specific idea). Optional inputs: `context`, `audience`, `risk_tolerance`, `focus_idea`, `focus_questions`, `constraints`. See SKILL.md Input Reference for details. |
| `commitment-extractor` | Extract explicit and implied commitments from meeting transcripts, normalize owner/date/artifact fields, and output an accountability-ready action list with evidence citations. Two modes: transcript-only (broad extraction) or transcript + context (targeted extraction with participant directory, focus person, meeting metadata). |

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
