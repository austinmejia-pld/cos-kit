Analyze the following meeting transcript for risks, tensions, assumptions, decision gaps, and recommended actions. Return ONLY valid JSON matching the output schema. No markdown fences, no explanation — just the JSON object.

## Meeting Information

- **Meeting ID:** {{meeting_id}}
- **Meeting Title:** {{meeting_title}}
{{meeting_date_line}}

## Participants

{{participants_block}}

{{context_block}}

{{objectives_block}}

## Transcript

{{transcript}}

## Output Schema

{{output_schema}}

## Output Requirements

1. `overall_risk_level` must be one of: low, medium, high.
2. `risks` must have at least 1 item. Each risk must have `evidence_quotes` with at least 1 verbatim quote.
3. `severity` and `likelihood` on each risk must be one of: low, medium, high.
4. `unresolved_tensions[].sides` must have at least 2 entries.
5. `hidden_assumptions[].evidence_quotes` must have at least 1 entry.
6. `recommended_actions` must have at least 1 item with `action`, `owner`, `due_date`, `success_artifact`.
7. `confidence` must be a number between 0 and 1.
8. Return ONLY the JSON object. No other text.
