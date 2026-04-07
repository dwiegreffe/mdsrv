# Skills Overview

## Summary
- This directory defines reusable agent skills for this repository.
- Skills keep repeated workflows consistent, compact, and easier to maintain.
- Current users are coding agents and maintainers who want predictable output quality.
- Primary entrypoint is each skill's `SKILL.md` frontmatter and rule sections.
- Primary extension point is adding a new skill folder with a focused, enforceable workflow.

## What
- A skill is a small policy + workflow package that standardizes one recurring task.
- Each skill defines hard rules, a step-by-step workflow, and writing/style constraints.
- Skills intentionally document decision logic and process, not implementation internals.
- Out of scope: replacing source-of-truth project files (code, templates, schema definitions).

## Why
- Repeated tasks drift quickly without a shared standard.
- Explicit rules reduce ambiguity, improve output consistency, and speed up reviews.
- Compact, skimmable instructions are easier for humans and agents to execute correctly.
- Keeping process intent in skills prevents copy-pasted ad-hoc prompting.

## How
- **Use:** Load the skill that matches the task, then follow its hard rules before acting.
- **Use:** Treat referenced project artifacts (templates, wiki docs, code) as source of truth.
- **Use:** Draft first when required by the skill, then ask for confirmation if action is sensitive.
- **Extend:** Add a new folder under `.agents/skills/<skill-name>/` with a focused `SKILL.md`.
- **Extend:** Keep rules enforceable, workflow ordered, and language short and bullet-heavy.
- **Integrate:** Align naming and metadata with existing skill frontmatter conventions.
- **Watch out:** Do not duplicate file listings or implementation detail that already lives in code.
