Analyze the following meeting transcript for stakeholder dynamics. Return ONLY valid JSON matching the stakeholder-analysis output schema. No markdown fences, no explanation — just the JSON object.

## Transcript

{{transcript}}

{{#focal_decision}}
## Focal Decision

The analysis should be oriented around this decision:

{{focal_decision}}
{{/focal_decision}}

{{#analysis_goal}}
## Analysis Goal

{{analysis_goal}}
{{/analysis_goal}}

{{#org_context}}
## Organizational Context

{{org_context}}
{{/org_context}}

{{#stakeholder_directory}}
## Known Stakeholders

The following stakeholders are pre-identified. Profile each of them even if their transcript evidence is thin. Discover additional stakeholders from the transcript.

{{stakeholder_directory_json}}
{{/stakeholder_directory}}

{{#key_questions}}
## Key Questions to Address

Answer these in the analysis or surface them in `open_questions` if evidence is insufficient:

{{#key_questions_list}}
- {{.}}
{{/key_questions_list}}
{{/key_questions}}

{{#time_horizon}}
## Time Horizon

Calibrate engagement plan urgency and risk assessment to: **{{time_horizon}}**
{{/time_horizon}}

{{#confidence_threshold}}
## Confidence Threshold

Only include findings with confidence >= {{confidence_threshold}}. Note excluded items in `open_questions`.
{{/confidence_threshold}}

## Output requirements

1. Set `metadata.mode_used` to `"{{mode_used}}"`.
2. Every stakeholder must have at least one entry in `evidence` (verbatim quote) or have `stance` set to `"unknown"`.
3. Every risk must have `early_signals` specific enough to monitor.
4. Every action must have `owner`, `due`/`timing`, and `proof_artifact`/`success_signal`.
5. Include `recommended_path` only if you have high confidence (3+ evidence-backed stakeholders, 2+ risks with early signals). Otherwise use the `"insufficient_information"` variant or omit entirely.
6. Return ONLY the JSON object. No other text.
