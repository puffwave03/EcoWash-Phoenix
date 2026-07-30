# Git Workflow

Status: Active

Version: 0.1

Last Updated: 2026-07-30

Current Mission: INFRA-001.1

Next Action: Reconcile Supabase migration history and finalize smoke baseline

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
- Do not add Docker files unless explicitly approved.
- Do not add dependencies without justification and approval.
- Keep user-visible copy localized; do not hardcode visible strings in React components.
- Keep translation-key structures identical across all supported locales.
- Use centralized design tokens for visual work.
- Do not add unsupported product claims, fake metrics, fake customer logos, fake certifications or fake backend behavior.

---

## Current Handover Note

The latest approved and pushed development commit is:

`f94df88 INFRA-001-SMOKE fix: resolve staging smoke test blockers`

INFRA-001.1 is the next approved mission. Before starting it, confirm `main` is clean and synchronized with `origin/main`, review the documentation entry points, and verify the Supabase target before any migration-history operation.

Do not use `git add .` for documentation-only closeouts. Stage only the Markdown files intentionally updated. Keep UX-002 and any staging cleanup in separate future commits.
