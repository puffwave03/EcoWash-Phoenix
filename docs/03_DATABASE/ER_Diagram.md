# ER Diagram

Status: Active

Version: 0.1

Last Updated: 2026-07-27

Current Mission: APP-002

---

## Purpose

Show the MVP entity relationship model for APP-002.

---

## Contents

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ LOCATIONS : owns
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : grants
    PROFILES ||--o{ ORGANIZATION_MEMBERSHIPS : holds

    ORGANIZATIONS ||--o{ CUSTOMERS : owns
    ORGANIZATIONS ||--o{ PROPERTIES : owns
    CUSTOMERS ||--o{ PROPERTIES : has

    ORGANIZATIONS ||--o{ SERVICES : defines
    SERVICES ||--o{ SERVICE_PRICES : priced_by
    LOCATIONS ||--o{ SERVICE_PRICES : overrides
    SERVICES ||--o{ CUSTOMER_SERVICE_PRICES : customized_by
    CUSTOMERS ||--o{ CUSTOMER_SERVICE_PRICES : receives
    PROPERTIES ||--o{ CUSTOMER_SERVICE_PRICES : receives

    ORGANIZATIONS ||--o{ ORDERS : owns
    LOCATIONS ||--o{ ORDERS : receives
    CUSTOMERS ||--o{ ORDERS : places
    PROPERTIES ||--o{ ORDERS : relates_to
    PROFILES ||--o{ ORDERS : creates
    PROFILES ||--o{ ORDERS : assigned

    ORDERS ||--o{ ORDER_ITEMS : contains
    SERVICES ||--o{ ORDER_ITEMS : snapshots
    ORDERS ||--o{ ORDER_STATUS_HISTORY : records
    PROFILES ||--o{ ORDER_STATUS_HISTORY : changes

    ORDERS ||--o{ PICKUPS : may_have
    ORDERS ||--o{ DELIVERIES : may_have
    PROFILES ||--o{ PICKUPS : assigned
    PROFILES ||--o{ DELIVERIES : assigned

    ORDERS ||--o{ PAYMENTS : paid_by
    PROFILES ||--o{ PAYMENTS : records

    ORDERS ||--o{ ORDER_PHOTOS : stores
    PROFILES ||--o{ ORDER_PHOTOS : uploads

    ORDERS ||--o{ ORDER_ISSUES : may_have
    ORDER_ISSUES ||--o{ ORDER_PHOTOS : may_reference
    PROFILES ||--o{ ORDER_ISSUES : reports

    ORGANIZATIONS ||--o{ NOTES : owns
    PROFILES ||--o{ NOTES : writes

    ORGANIZATIONS ||--o{ AUDIT_LOGS : audits
    PROFILES ||--o{ AUDIT_LOGS : acts
```

Diagram notes:

- `organizations` is the tenant boundary.
- Some child tables inherit tenant access through `orders`.
- `notes` uses scoped entity references and must still carry `organization_id`.
- The diagram omits detailed fields; full field requirements live in Domain Model, Entities and Database Design.
