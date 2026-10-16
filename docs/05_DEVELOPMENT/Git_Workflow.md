# Git Workflow

Status: Active

Version: 0.1

Last consolidated: 2026-10-16

Scope: stable Git procedure. Current work and baseline: [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) and [Project Status](../06_ROADMAP/Project_Status.md). Follow [AGENTS.md](../../AGENTS.md) and the explicit task prompt.

---

## Purpose

Define the current Git workflow for EcoWash Phoenix so application work, review, approval and documentation-only commits stay separated.

---

## Rules

- One mission per commit.
- Codex implements requested changes.
- ChatGPT reviews architecture and output.
- Product Owner approval is required before development commits.
- Documentation-only commits must stage only Markdown files.
- Do not use `git add .` or `git add -A` for documentation-only missions.
- Do not stage application files, images, package files, styles, translations or configuration during documentation-only missions.
- Do not reset, discard or revert approved uncommitted work unless explicitly instructed.
- Commit, push and deployment require explicit authorization for that phase. Do not create preservation commits or branches automatically.
- Verify branch, HEAD, staged/unstaged/untracked files and expected pre-existing work before changing anything. A known authorized dirty worktree is not a reason to reset it or demand unrelated cleanup.
- Before an authorized commit, stage an explicit reviewed file list and run `git diff --cached --check`. Use normal push only; after push verify local/remote alignment and the required clean state.
- Do not add Docker files unless explicitly approved.
- Do not add dependencies without justification and approval.
- Keep user-visible copy localized; do not hardcode visible strings in React components.
- Keep translation-key structures identical across all supported locales.
- Use centralized design tokens for visual work.
- Do not add unsupported product claims, fake metrics, fake customer logos, fake certifications or fake backend behavior.

---

## Historical Handover Note — 2026-08-22

The following dated commit and next-task proposal are retained as history. They do not identify today's baseline or authorize QA-001, commits, fixtures or cleanup. Resume from the two canonical documents above.

<details>
<summary>Original DOCS-OPS-017 checkpoint — historical only</summary>

The latest approved and pushed development commit before DOCS-OPS-017 is:

`edebb79 UI-FORMAT-005 feat: normalize quantity and currency formatting`

The operational role/workspace phase is validated. Confirm `main` is clean and synchronized with `origin/main`, then follow `docs/00_START_HERE/SESSION_HANDOVER.md`. `QA-001` remains the next existing M1/P0 gate; the Product Owner chooses whether the following macro-phase is full-app visual/product refinement or the next approved business module.

Working loop: the Product Owner defines behavior and performs simple visual/functional checks; ChatGPT acts as CTO, architect and reviewer and prepares Codex tasks; Codex implements and reports. Keep the Product Owner's technical burden minimal and keep one task per logical commit.

Do not use `git add .` for documentation-only closeouts. Stage only the Markdown files intentionally updated. Keep staging cleanup separate and do not delete old test orders without explicit approval.

</details>
