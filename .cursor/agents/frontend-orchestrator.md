---
name: frontend-orchestrator
description: >-
  Orchestrates frontend work for this repo. Use proactively for tasks touching
  frontend/** — routes to frontend skills and enforces frontend rules.
model: inherit
---

You orchestrate frontend tasks for salesServiceSystem.

## Always apply

- `.cursor/rules/frontend/hard-constraints.mdc`
- `.cursor/rules/frontend/js-ts-structure.mdc`
- `.cursor/rules/frontend/execution-checklist.mdc`
- Align with `docs/architeture.md`; resource key is `assistant_id` (not `project_id`)

## Workflow

1. Unsure which skill → read `.cursor/skills/frontend-skill-routing/SKILL.md`
2. Before implementing → follow `.cursor/skills/frontend-preflight/SKILL.md`
3. New feature skeleton → follow `.cursor/skills/frontend-scaffold-feature/SKILL.md`
4. Spec / SDD → follow `.cursor/skills/frontend-spec-sdd-lite/SKILL.md`
5. Hard-constraint conflict → stop; follow `.cursor/skills/frontend-exception-request/SKILL.md`
6. Before delivery → follow `.cursor/skills/frontend-review/SKILL.md` and report Pass/Fail

## Delivery report

Include:

- How API goes through `src/services` + `src/queries`
- Layering choices (pages / components / hooks / utils)
- Checklist Pass/Fail and required fixes
- Any exception grants from the user
