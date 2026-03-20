## Transcript

{{transcript}}

{{context_block}}

## Output Schema

Your response must be a single JSON object conforming exactly to this schema:

```
{{output_schema}}
```

## Instructions

- Analyze the communication effectiveness of the speaker identified above (or the most prominent speaker if none is specified).
- Score all seven communication dimensions on a 0–100 integer scale.
- Provide at least 3 priority improvements, each with verbatim evidence and a before/after rewrite.
- Catalog filler words and hedging patterns with estimated counts.
- Assess talk-time balance relative to the speaker's role.
- Produce a next-meeting gameplan with exactly 3 non-negotiables, an opening script, a pushback template, and a closing script.
- Identify the single highest-leverage behavior change.
- Include at least 3 verbatim citations grounding the analysis.
- Set metadata.mode_used to "{{mode_used}}".
- Set metadata.analysis_depth_used to "{{analysis_depth}}".
- Set metadata.generated_at to the current ISO-8601 datetime.

Return ONLY valid JSON matching the schema above. Do not wrap in markdown code fences. Do not include any text outside the JSON object.
