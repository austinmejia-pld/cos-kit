## Transcript

{{transcript}}

{{context_block}}

## Output Schema

Your response must be a single JSON object conforming exactly to this schema:

```
{{output_schema}}
```

## Instructions

- Analyze the communication effectiveness of the speaker identified in the context block above. If no speaker is specified, analyze the most prominent speaker in the transcript. Do not ask for clarification — work with what you have.
- Score all seven communication dimensions on a 0–100 integer scale.
- Provide at least 3 priority improvements, each with verbatim evidence and a before/after rewrite.
- When writing `rewrite.after` text, use vocabulary and sentence patterns consistent with the speaker's actual voice in the transcript. Do not introduce language or jargon they do not use. The rewrite should sound like them on a good day, not like a different person.
- Catalog filler words and hedging patterns with estimated counts.
- Assess talk-time balance relative to the speaker's role.
- Produce a next-meeting gameplan with exactly 3 non-negotiables, an opening script, a pushback template, and a closing script.
- Identify the single highest-leverage behavior change.
- Include at least 3 verbatim citations grounding the analysis.

### Handling Missing Context

- If `user_name` is not provided: coach the most prominent speaker.
- If `communication_goal` is not provided: infer the likely goal from the transcript content and note the inference.
- If `audience_context` is not provided: infer the audience from speaker roles and dynamics visible in the transcript.
- If `tone_target` is not provided: default to neutral and coach based on what the situation demands.
- If `participant_directory` is not provided: identify speakers from transcript labels.
- If `focus_areas` is not provided: score all dimensions and let the data determine priority.
- If `key_questions` is not provided: let the analysis surface the most important findings organically.

### Metadata

- Set `metadata.mode_used` to "{{mode_used}}".
- Set `metadata.analysis_depth_used` to "{{analysis_depth}}".
- Set `metadata.generated_at` to the current ISO-8601 datetime.

Return ONLY valid JSON matching the schema above. Do not wrap in markdown code fences. Do not include any text outside the JSON object.
