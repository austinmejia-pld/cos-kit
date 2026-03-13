Analyze the following interview transcript against the rubric below. Return ONLY valid JSON matching the output schema. No markdown fences, no explanation — just the JSON object.

## Candidate Information

- **Candidate:** {{candidate_name}}
- **Role:** {{role}}
- **Stage:** {{stage}}
{{interviewer_line}}
{{interview_date_line}}

{{must_have_block}}

## Rubric

{{rubric_block}}

## Transcript

{{transcript}}

## Output Schema

{{output_schema}}

## Output Requirements

1. `recommendation` must be one of: strong_yes, yes, mixed, no, strong_no.
2. `confidence` must be a number between 0 and 1.
3. `decision_summary` must be at least 20 characters.
4. `dimension_scores` must have one entry per rubric dimension.
5. Each `dimension_scores` entry must include at least one verbatim quote in `evidence_quotes`.
6. `score` must be an integer 1-4.
7. Return ONLY the JSON object. No other text.
