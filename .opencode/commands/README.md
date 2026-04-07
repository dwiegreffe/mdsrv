# OpenCode Commands

## Summary
- This directory stores reusable slash-command definitions for the local OpenCode workflow.
- It exists to keep common engineering actions consistent and quick to run.
- It is used by OpenCode command execution in this repository.
- Entrypoints are the command markdown files in this folder (for example, `commit.md`).
- Extension point is adding new `<command>.md` files with frontmatter and clear execution instructions.

## What
- Scope: define high-level command behavior for common development tasks.
- It provides command templates for committing changes, planning work from issues, and starting feature work.
- Each command is a markdown file with a short `description` frontmatter and step instructions.
- It is intentionally not the place for business logic implementation; commands orchestrate workflows.

## Why
- Repeated workflows are easier to execute and review when phrased as explicit command definitions.
- Shared command prompts reduce ambiguity and keep team workflows aligned.
- Keeping commands in version control makes improvements visible and reviewable.
- Tradeoff: commands stay concise, so advanced edge-case handling is delegated to the executing agent and project conventions.

## How
- **Use:** Run an available command from OpenCode and pass arguments when required (for example, issue IDs for planning commands).
- **Use:** Keep command text action-oriented and specific about required tools (for example, `glab issue view`).
- **Extend:** Add a new markdown file in this directory with YAML frontmatter containing `description`.
- **Extend:** Write steps that describe intent, decision points, and expected outputs, not low-value boilerplate.
- **Integrate:** Align each command with repository conventions (branching, structure, testing expectations).
- **Watch out:** Avoid embedding repository-specific assumptions that are not stable or documented elsewhere.
