---
name: readme-definition
description: Create compact, future-proof READMEs that document intent and usage using a What/Why/How structure.
---

# README Definition

Create project-consistent READMEs that stay useful over time by documenting context and intent, not implementation duplication.

## Hard Rules
1. Treat code and file structure as the implementation source of truth; do not mirror directory contents in the README.
2. Focus on meta-information that is hard to infer from code:
   - idea
   - intent
   - purpose
   - tradeoffs
   - usage and extension guidance
3. Follow the required top-level structure in this order:
   - `Summary`
   - `What`
   - `Why`
   - `How`
4. Keep wording compact: as short as possible, as detailed as necessary.
5. Prefer bullets over long prose; keep sections skimmable and human-readable.
6. Avoid repeating the same information across sections.
7. If critical information is unclear after reviewing codebase and current discussion, ask targeted clarification questions before finalizing.
8. Do not invent intent, constraints, or operational claims that are not supported by code or user input.
9. Include practical guidance:
   - how to use
   - how to extend
   - boundaries and non-goals

## Required README Structure

### 1) Summary
A compact scan-first section (3-6 bullets):
- what this module/system is
- why it exists
- who/what depends on it
- primary usage entrypoint(s)
- key extension point(s)

### 2) What
Define the module/system (3-7 bullets):
- scope and responsibility
- main capabilities
- boundaries (what it does not do)

### 3) Why
Capture intent and rationale (3-7 bullets):
- problem being solved
- expected value/outcome
- key design decisions and tradeoffs

### 4) How
Practical operation guidance (4-10 bullets):
- how to use it (minimal steps/examples)
- how to expand/extend it safely
- integration points and constraints
- common pitfalls or failure modes (only if relevant)

## Template

Use this template for README drafts:

```md
# <Module or System Name>

## Summary
- <What it is in one line>
- <Why it exists in one line>
- <Who/what uses it>
- <Primary entrypoint(s)>
- <Primary extension point(s)>

## What
- <Scope and ownership>
- <Core capability 1>
- <Core capability 2>
- <Boundary: what is intentionally out of scope>

## Why
- <Problem this solves>
- <Expected value or outcome>
- <Key design choice>
- <Tradeoff accepted>

## How
- **Use:** <Minimal usage step or command>
- **Use:** <Typical workflow>
- **Extend:** <Where to add new behavior>
- **Extend:** <Rules/patterns to follow>
- **Integrate:** <Dependencies or external touchpoints>
- **Watch out:** <Common pitfall or constraint>
```

## Workflow
1. Inspect codebase and existing docs for factual grounding.
2. Extract only information that should live outside code (intent, rationale, usage, extension).
3. Draft README in `Summary -> What -> Why -> How` order.
4. Remove duplicated implementation detail and file-list noise.
5. Tighten language for scanability (short bullets, minimal prose).
6. If required context is missing or ambiguous, ask concise clarification questions.
7. Deliver final README draft.

## Writing Style
- Use Markdown headings and bullet lists heavily.
- Prefer short bullets (one idea per bullet).
- Keep paragraphs rare and brief.
- Use explicit, plain language; avoid buzzwords and filler.
- Optimize for fast human scanning and long-term maintainability.

## Quality Checklist
Before finalizing, verify:
- no directory dump or file-by-file repetition
- clear `What`, `Why`, and `How`
- includes compact `Summary`
- includes usage and extension guidance
- no unsupported assumptions
- concise, readable, non-redundant text
