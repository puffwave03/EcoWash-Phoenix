# Frontend

Status: Active

Version: 0.1

Last Updated: 2026-07-28

Current Mission: APP-004

---

## Purpose

Define the current frontend application boundary for the public website and protected dashboard foundation.

---

## Contents

## Public Website

The public website remains under locale-prefixed routes such as `/en`, `/it`, `/es`, `/fr`, `/de` and their contact pages. APP-004 does not modify homepage marketing components or public content.

## Authentication Routes

APP-004 adds:

- `/[locale]/login`
- `/[locale]/app`
- `/[locale]/app/access-denied`

The login route uses a minimal branded form. The dashboard route is a protected shell only. It does not show customers, orders, payments, photos or operational metrics.

## Dashboard Shell

The dashboard shell displays:

- current user display name or email fallback
- active organization name
- active role
- logout button
- one placeholder navigation item: Overview

No module navigation is shown for unavailable features.

## Localization

Login, logout, dashboard foundation and access-denied text live in the existing locale files under `src/i18n/*/common.json`.
