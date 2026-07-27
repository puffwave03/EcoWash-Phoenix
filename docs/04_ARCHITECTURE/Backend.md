# Backend

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: APP-002

---

## Purpose

Define backend boundaries for the future EcoWash MVP without implementing backend code.

---

## Contents

## Backend Direction

Supabase remains the candidate backend for:

- Auth
- PostgreSQL
- Storage
- Row Level Security

APP-002 does not create a Supabase project, write migrations, configure clients or add dependencies.

## Initial Backend Responsibilities

- Authenticate users.
- Resolve profile and organization membership.
- Enforce tenant boundary through RLS and server-side checks.
- Store normalized operational records.
- Store private order photos with ownership checks.
- Record audit events for sensitive actions.

## Server Boundary

Future Next.js server actions or API routes may be used for operations that require extra validation beyond direct RLS-protected data access, especially:

- membership and role changes
- price changes
- production status corrections
- payment recording and voiding
- signed URL creation
- audit log writes

The client must never receive service-role credentials.

## Not In MVP Backend

- Realtime
- Edge Functions unless a verified need appears
- Online payment providers
- OCR or Google Vision
- Push notifications
- PDF/fiscal invoice generation
- Customer portal backend
- Native mobile backend assumptions

## Data Ownership Boundary

Operational records are accessed through organization membership. Staff access may be further limited by assignment in application logic or future RLS policy where practical.
