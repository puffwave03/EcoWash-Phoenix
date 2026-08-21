# Git Workflow

Status: Active

Version: 0.1

Last Updated: 2026-08-21

Current Mission: Operational workspace access testing

Next Action: Resume Production, Quality and Delivery staging tests after the Supabase Auth email rate limit clears

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

`ecf0c8a BUG-AUTH-005 fix: harden staff auth callback and rate-limit handling`

The current resume point is functional staging validation, not migration work. Confirm `main` is clean and synchronized with `origin/main`, then follow `docs/00_START_HERE/SESSION_HANDOVER.md`. Do not repeat malformed-Auth diagnosis for Production Test without new evidence; the current block is the Supabase Auth email rate limit.

Do not use `git add .` for documentation-only closeouts. Stage only the Markdown files intentionally updated. Keep staging cleanup separate and do not delete old test orders without explicit approval.
