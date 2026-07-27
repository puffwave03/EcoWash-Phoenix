# Git Workflow

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: DEV-010

Next Action: Public website final audit and release preparation

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

`2834289 DEV-009.5 feat: complete homepage visual enrichment`

DEV-010 is the next mission. Before starting implementation, confirm `main` is clean and synchronized with `origin/main`, review the documentation entry points, start the existing local Next.js environment with `npm run dev`, and confirm the final audit scope. A documentation-only commit must stage only Markdown files.
