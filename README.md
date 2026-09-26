# Haystax — Boarding Management Platform

A full-stack boarding house discovery and management platform for Sri Lanka, built with Angular 21, Spring Boot, Supabase (PostgreSQL + PostGIS), RabbitMQ, and Docker.

---

## Overview

Haystax is a full-stack application that lets students and working professionals discover, compare, and book boarding houses, while giving owners tools to manage listings and admins a moderation surface — all backed by a geo-aware search engine and an event-driven notification backbone.

The platform serves three distinct user roles through a common dashboard: tenants track their profile and reservation history, owners manage their listed properties and incoming booking requests, and admins moderate the platform — all from a single unified dashboard surface with role-aware sections.

The project is developed by three members, each owning a vertical slice of the stack:

| Member | Slice |
|--------|-------|
| **Naviru (M1)** | Homepage (Public Discovery), Search Results & Recommendations, Listing Details, Admin Panel |
| **Anoj (M2)** | Auth (Login/Register), Common User Dashboard (Profile, Reservations, Listing Management & Booking Requests) |
| **Binuwara (M3)** | Engagement & Insights, Booking Handling, Messaging & Notifications, Review & User Complaint Handling |

---

## Features

### Discovery & Search
- **Home page** — hero banner, search bar, featured and popular listings, and quick-filter chips for city, price, and gender policy.
- **Search Results** — filter panel driven entirely by URL query params (shareable and back-button-friendly), supporting city, min/max price, gender policy, amenities, and sort (relevance, price ascending/descending, distance).
- **Geo-aware search** — PostGIS radius search (`ST_DWithin`) and distance ordering on a GIST-indexed location column, so users can find boardings "within X km of me".
- **Listing Details** — photo gallery with thumbnail strip, full description, amenities chips, location panel, owner display name, star rating summary with a 5-row distribution bar, and "Request tenancy" / "Send inquiry" actions.
- **Recommendations** — ranked "Recommended for you" list with a human-readable "Why recommended" reason under each card.
- **Loading, empty, and error states** — every page handles all three states consistently via a shared state component.

### Accounts, Authentication & Profile
- **Unified Login / Register** — single auth surface with role-aware routing based on JWT claims (`is_owner`, `is_admin`).
- **Common User Dashboard** — one dashboard that adapts its visible sections to the logged-in user's role and activity, serving tenants, owners, and admins from the same surface.
- **Profile details** — name, contact information, role badges, and account settings in one place.
- **JWT security** — issue/refresh/validate flow, role claim resolution from the database (never from the client), and a Spring Security filter chain.
- **Row Level Security (RLS)** — Supabase policies enforce per-listing ownership so a dual-role user cannot escalate across listings; storage policies prevent cross-user access to the `listing-photos` bucket.

### Reservation History (Tenant View)
- **Requested boardings list** — every boarding place the tenant has requested, consolidated in one view.
- **Status tracking** — each reservation displays its current status: `pending`, `confirmed`, `rejected`, `withdrawn`, or `expired`.
- **Reservation detail** — per-request view with the listing snapshot, request date, owner response, and any messages tied to the request.

### Listing Management (Owner View)
- **Owned listings** — a table of every place the owner has listed, with moderation state, vacancy, and edit/remove actions.
- **Create / Edit Listing** — required-field validation, photo upload with progress and error states, moderation state display, and forbidden-field stripping (clients cannot set `owner_id`).
- **Manage bookings** — confirm or reject incoming booking requests directly from the dashboard, with the listing's `available_slots` updated atomically on confirmation.
- **Booking request inbox** — pending requests surfaced inline so the owner can act without leaving the dashboard.

### Booking, Messaging & Notifications
- **Booking / Inquiry flow** — tenant-side inquiry submission with manual owner confirmation, optimistic UI, failure rollback, and double-submit prevention.
- **Concurrency-safe tenancy confirmation** — the tenancy transaction locks the listing row so two parallel confirmations on the same last slot result in exactly one success and one `available_slots` decrement.
- **Real-time Messaging** — conversation list, unread badge, chat bubbles, and a flagged-message banner.
- **Notification backbone** — RabbitMQ-based fan-out with idempotent consumers, so duplicate `tenancy.confirmed` or `message.created` events create exactly one notification.
- **In-app notifications** — All / Property / Messaging / Admin tabs with per-notification context (related listing + event type).

### Reviews & Ratings
- **Eligibility pipeline** — reviews restricted to confirmed tenancies, with unique-per-tenancy enforcement.
- **Rating input** — star bounds, content validation, and hidden/removed review handling.
- **Rating summary** — average score plus a 5-row distribution breakdown shown on the listing detail page.

### Analytics & Insights
- **Owner analytics** — aggregated views of listing performance, reservation activity, and rating trends, with date ranges and filters.
- **Admin analytics** — platform-level counts of tenants, listings, pending reviews, and flagged reports.
- **No cross-owner leakage** — aggregations are scoped so an owner only sees their own data; admins see platform-wide.

### Admin & Moderation
- **Moderation queue** — review flagged and pending listings, apply moderation actions (approve, suspend, remove), and notify owners.
- **Role management** — view and manage user roles (`is_owner`, `is_admin`) via a role table.
- **Report handling** — inspect submitted reports with evidence, and resolve or escalate them.
- **Authorization boundary** — non-admin users receive an authorization error with no partial data leaked.

### Platform & Architecture
- **PostGIS geo search** — radius search and distance ordering on a GIST-indexed location column.
- **Event-driven architecture** — transactional outbox pattern with versioned event contracts (`tenancy.confirmed`, `message.created`, `report.submitted`, `discovery.viewed`).
- **Versioned REST + event contracts** — documented in `docs/api-contracts/` and `docs/event-contracts/` so integration is a swap, not a rewrite.
- **Mock-to-real adapter pattern** — the Angular client is wired through service interfaces so the mock fixture layer is swapped for the real Spring Boot API without touching page logic.
- **One-command local startup** — `./start-all.sh` brings up RabbitMQ + Redis (Docker), Spring Boot, and Angular; `./stop-all.sh` tears everything down.

### Design System
- **Single shared design system** — Tailwind CSS v4 with a shared token set (dark slate sidebar, cyan-teal primary, rounded-2xl cards, badge variants for Available / Full / Under Review / Flagged / Pending / Confirmed / Rejected).
- **Shared shell** — a common `AppShell` (sidebar + topbar) wrapping every page, with role-aware nav items.
- **Frozen shared components** — `ListingCard`, `PageHeader`, `StateView`, `RatingStars`, `DataTable`, `StatCard`, `Badge`, `Modal`.
- **Consistent states** — every page renders loading, empty, error, and success states through shared components, so the UI feels uniform across all slices.

---

## Tech Stack

**Frontend**
- Angular 21 (lazy-loaded feature routes, standalone components)
- TypeScript
- Tailwind CSS v4
- spartan/ui (Angular port of shadcn/ui)
- ng-icons (Heroicons)
- Leaflet (map integration)
- Chart.js / ng2-charts (analytics & admin dashboard)

**Backend**
- Spring Boot 4
- Spring Security + JWT
- Spring Data JPA / Hibernate
- Flyway (migrations)
- Maven

**Data & Infrastructure**
- Supabase (hosted PostgreSQL + PostGIS)
- RabbitMQ (message broker)
- Redis (cache)
- Docker + Docker Compose
- Nginx (reverse proxy in prod)

**Testing**
- Jasmine + Karma (Angular unit/component tests)
- HttpTestingController (Angular HTTP contract tests)
- JUnit 5 + Mockito + Spring Boot Test (backend)
- Testcontainers (PostgreSQL/PostGIS + RabbitMQ integration tests)
- Cypress (end-to-end)
- Pact / DTO-shape assertions (cross-member contract tests)

---

## Repository Structure

```
haystax/
├── frontend/                  # Angular SPA
│   └── src/app/
│       ├── core/              # Models, guards, interceptors, cross-cutting services
│       ├── shared/            # Reusable components, pipes, layout shell
│       └── features/
│           ├── discovery/     # Member 1
│           ├── admin/         # Member 1
│           ├── dashboard/     # Member 2 (profile, reservations, listing management)
│           ├── auth/          # Member 2
│           └── engagement/    # Member 3
├── backend/                   # Spring Boot app (M1 + M2 slices)
│   └── src/main/java/com/haystax/
│       ├── common/            # Shared security, events, exceptions
│       ├── discovery/         # Member 1
│       ├── admin/             # Member 1
│       ├── dashboard/         # Member 2
│       └── auth/              # Member 2
├── notification-service/      # Spring Boot consumer (Member 3)
├── infra/                     # Docker Compose, Nginx, Postgres init
├── docs/                      # Page contracts, API contracts, event contracts, design system
├── start-all.sh               # One-command local startup
├── stop-all.sh                # One-command shutdown
└── README.md
```

---

## Local Setup

### Prerequisites
- Node.js LTS (20.x or 22.x)
- Angular CLI (`npm i -g @angular/cli`)
- Java JDK 17 or 21
- Maven (or use the bundled `./mvnw`)
- Docker Desktop with the Compose plugin
- A Supabase project (hosted)

### Configure the backend
Copy the example config and fill in your Supabase credentials:

```bash
cp backend/src/main/resources/application.properties.example \
   backend/src/main/resources/application.properties
```

Edit `application.properties` and set:

```properties
spring.datasource.url=jdbc:postgresql://aws-0-<region>.pooler.supabase.com:5432/postgres
spring.datasource.username=postgres.<your-project-ref>
spring.datasource.password=<your-db-password>
```

> Use the **Connection Pooler** host (IPv4), not the Direct Connection (IPv6-only on the free tier).

### Start everything

```bash
./start-all.sh
```

This brings up:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend | http://localhost:8080 |
| Backend health | http://localhost:8080/actuator/health |
| RabbitMQ Management UI | http://localhost:15672 (`haystax` / `haystax`) |
| Redis | `localhost:6379` |

### Stop everything

```bash
./stop-all.sh
```

---

## URLs & Endpoints

### Application

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4200 |
| Backend | http://localhost:8080 |
| Health | http://localhost:8080/actuator/health |

### Discovery API (Member 1)

```
GET /api/discovery/listings
GET /api/discovery/listings/near?lat=&lng=
GET /api/discovery/listings/{id}
GET /api/discovery/recommendations
```

### Admin API (Member 1)

```
GET  /api/admin/stats
GET  /api/admin/moderation-queue
POST /api/admin/listings/{id}/approve
POST /api/admin/listings/{id}/suspend
POST /api/admin/listings/{id}/remove
GET  /api/admin/reports
POST /api/admin/reports/{id}/resolve
GET  /api/admin/roles
```

### Dashboard API (Member 2)

```
GET    /api/dashboard/profile
PUT    /api/dashboard/profile
GET    /api/dashboard/reservations              # tenant's requested boardings + statuses
GET    /api/dashboard/reservations/{id}
GET    /api/dashboard/listings                  # owner's listed properties
POST   /api/dashboard/listings
PUT    /api/dashboard/listings/{id}
DELETE /api/dashboard/listings/{id}
GET    /api/dashboard/bookings                  # incoming booking requests
POST   /api/dashboard/bookings/{id}/confirm
POST   /api/dashboard/bookings/{id}/reject
```

### Auth API (Member 2)

```
POST /auth/signup
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

### Supabase Dashboard

```
https://supabase.com/dashboard/project/<your-project-ref>
```

---

## Design System

The UI follows a single design system documented in `docs/design-system.md`.

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#1E6B7A` | Buttons, links, active nav |
| Sidebar | `#1F2937` | Dark slate left navigation |
| Background | `#F9FAFB` | Page background |
| Card | `#FFFFFF` | Content cards, border `#E5E7EB` |
| Success | `#22C55E` | "Available" / "Confirmed" badges |
| Warning | `#F59E0B` | "Under Review" / "Pending" badges |
| Destructive | `#DC2626` | "Suspend", "Remove", "Rejected", "Flagged" |

### Shape
- Card: `rounded-2xl`, `p-6`, `shadow-card`
- Input / Button: `rounded-lg`
- Badge: `rounded-full`

### Frozen shared components
`app-shell`, `page-header`, `stat-card`, `data-table`, `badge`, `modal`, `empty-state`, `loading-state`, `error-state`, `listing-card`, `rating-stars`.

### Rules
- No member defines new colors outside the tokens.
- No member writes custom buttons — use `.btn-primary` / `.btn-outline`.
- No member writes custom cards — use `.card`.

---

## Testing Strategy

| Priority | What | Tool | Week |
|----------|------|------|------|
| P0 | Mock data filter/sort/recommend logic | Jasmine pure unit tests | 1 |
| P0 | Component render + loading/empty/error/success states | TestBed + `detectChanges()` | 1 |
| P1 | HTTP params and URLs | HttpTestingController | 2–3 |
| P2 | DTO shape matches peer contract | HttpTestingController flush + type assertions | 4 |
| P3 | End-to-end user flows | Cypress | 4 |

### Per-member coverage targets
- **Member 1 (Discovery & Admin)** — ~80% — filters, geo math, ranking determinism, component states, moderation authorization boundaries.
- **Member 2 (Dashboard & Identity)** — ~85% — auth boundaries, ownership scoping, reservation status transitions, booking confirm/reject authorization, upload validation, RLS.
- **Member 3 (Engagement)** — ~80% — concurrency, idempotency, aggregation, state machine.

### Run tests

```bash
cd frontend
ng test --watch=false --browsers=ChromeHeadless --code-coverage
```

```bash
cd backend
./mvnw verify
```

---

## Git Workflow

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, protected, merged only via PR |
| `develop` | Integration branch, all features merge here first |
| `M1_Naviru` | Member 1's working branch (Public Discovery & Admin) |
| `M2_Anoj` | Member 2's working branch (User Dashboard & Identity) |
| `M3_Binuwara` | Member 3's working branch (Engagement & Insights) |

### Rules
- Never push directly to `main` or `develop` — use PRs.
- Each member pushes freely to their own branch.
- Before merging to `develop`, rebase on the latest `develop`.
- Never commit: `.env`, `application.properties` (real), `node_modules/`, `target/`, `.logs/`.

---

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/page-contracts/` | Per-member page contracts and acceptance criteria |
| `docs/api-contracts/` | OpenAPI specs for each slice's REST endpoints |
| `docs/event-contracts/` | JSON schemas for RabbitMQ events |
| `docs/design-system.md` | Design tokens and frozen component list |
| `docs/rls-matrix.md` | Row Level Security matrix (anonymous, tenant, owner, dual-role, admin) |
| `docs/branch-workflow.md` | Git workflow rules |

---

## Roadmap

- **Week 1** — Angular workspace, design system, mock data, 4 discovery pages, Spring Boot scaffolding, Supabase connected, one-command startup.
- **Week 2** — Spring Boot discovery controller + PostGIS radius search, real `DiscoveryApiService`, Supabase migrations, JWT auth foundation, dashboard scaffolding (profile, reservations, listings).
- **Week 3** — Dashboard booking request inbox + confirm/reject flow, admin moderation queue + role management, listing editor with photo upload, geo map (Leaflet), messaging scaffolding.
- **Week 4** — Swap mocks for real APIs, notification service, event contracts, contract tests, E2E flows, merge to `develop`.

---

## Contributors

| Member | Slice | Focus |
|--------|-------|-------|
| **Naviru** | Public Discovery & Admin | Angular discovery UI, PostGIS radius search, deterministic ranking, mock-to-real adapter, admin moderation queue, role management, dashboard stats |
| **Anoj** | User Dashboard & Identity | JWT auth, unified dashboard (profile, reservation history, listing management, booking confirm/reject), ownership scoping, upload pipeline, RLS |
| **Binuwara** | Engagement & Insights | Concurrency-safe tenancy, RabbitMQ notifications, reviews, analytics |

---

## License

This project is developed by the above 3 members as part of a PET project. All rights reserved by the authors.
