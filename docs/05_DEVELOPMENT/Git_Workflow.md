# Git Workflow

Status: Active

Version: 0.1

Current workflow clarification: 2026-10-28. Earlier consolidation: 2026-10-16.

Scope: stable Git procedure. Current work and baseline: [Session Handover](../00_START_HERE/SESSION_HANDOVER.md) and [Project Status](../06_ROADMAP/Project_Status.md). Follow [AGENTS.md](../../AGENTS.md) and the explicit task prompt.

---

## Purpose

Define the current Git workflow for EcoWash Phoenix so application work, review, approval and documentation-only commits stay separated.

---

## Current ordinary mission sequence

1. CTO reads the latest [Handover](../00_START_HERE/SESSION_HANDOVER.md), [Project Status](../06_ROADMAP/Project_Status.md), relevant code and tested precedent before opening a mission. Prefer the last verified method. A theoretical concern or missing evidence alone does not automatically create a new mission; a different procedure needs a demonstrated limitation, technical rationale and Product Owner approval.
2. Codex implements one authorized mission locally, runs the smallest relevant validation and reports the evidence and remaining gates. CTO reviews the exact patch. Previously passing tests are not repeated without a pertinent change or evidence gap. Reuse existing environments and administrative SaaS controls where sufficient; repetitive manual SQL is not the default operational path.
3. After the required CTO review and explicit Product Owner commit/push approval, select only the reviewed mission files by explicit path. Preserve pre-existing unrelated changes outside the index. Verify `git diff --cached --name-status`, `git diff --cached --check` and the remaining unstaged/untracked inventory before one coherent commit.
4. Push the approved commit to GitHub `main` only under that authorization. The configured integration automatically deploys it to `ecowash-phoenix-staging`; its internal Vercel `production` target is not commercial Phoenix production. The ordinary path needs no Vercel CLI or separate manual deployment.
5. Verify local `main`, `origin/main`, the GitHub source SHA and the new staging deployment's project/state. Product Owner performs the scoped staging browser E2E; close out the mission in the canonical Handover, Project Status and Testing evidence index, separating PASS results from remaining evidence gaps. Do not mark a specific gate PASS without its own evidence.

Development, CTO review, tests, commit/push, automatic deployment and Product Owner UAT are distinct gates. A different publication method or test environment requires explicit scope and approval; this document alone grants no commit, push or deployment authority.

**Order clarification for this approved staging workflow:** [AGENTS.md](../../AGENTS.md) §§2 and 14 contain an older generic sequence that places PO E2E before commit/push and asks for a clean worktree after push. The verified GitHub `main` integration deploys this staging application only after the authorized push, so staging PO UAT follows that deployment. The mission-specific CTO/PO authorization controls that sequence. Preserve unrelated local work and verify its inventory after push; do not reset it to satisfy the older clean-worktree wording. Alignment of the permanent AGENTS contract remains a separate CTO/PO decision; this document does not edit it.

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
- Before an authorized commit, stage an explicit reviewed file list and run `git diff --cached --check`. Use normal push only; after push verify local/remote alignment and inventory any preserved unrelated local changes.
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
