Perform an adversarial red-team analysis of the following meeting transcript. Return ONLY valid JSON matching the output schema. No markdown fences, no explanation — just the JSON object.

## Transcript

{{transcript}}

{{context_block}}

## Output Schema

{{output_schema}}

## Output Requirements

1. Set `metadata.mode_used` to `"{{mode_used}}"`.
2. Every failure mode must have a concrete, specific `title` tied to meeting content. No generic labels.
3. `severity` and `likelihood` are integers 1-5.
4. Every `key_assumptions[].evidence_from_transcript` must be a verbatim quote from the transcript.
5. `adversarial_questions` must be sharp and specific — not generic strategy questions.
6. `decision_recommendation.required_next_checks` must be specific enough that someone can execute and report back.
7. Return ONLY the JSON object. No other text.
