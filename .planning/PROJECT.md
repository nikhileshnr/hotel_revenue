# Hotel Revenue Management Game

## What This Is

A multiplayer educational simulation game where students compete as hotel revenue managers, making real-time decisions on guest bookings while learning about demand forecasting, pricing strategy, and risk management. Teachers create sessions, students join lobbies, and compete across multiple weeks with ML-generated guest profiles. The frontend uses a Claymorphism ("Organic Brutalism") design from Stitch.

## Core Value

Students can play through a complete hotel revenue management simulation with real-time guest decisions, seeing the consequences of their choices through detailed analytics and insights.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Backend game engine — auth, sessions, Socket.io, game logic — existing
- ✓ Demand model pipeline — CTGAN + LightGBM trained models — existing
- ✓ Profile service — FastAPI guest generation microservice — existing
- ✓ Database schema — 10 migrations, 7 tables — existing
- ✓ Room inventory — LOS-aware calendar system in Redis — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Implement Landing/Auth screens (Teacher + Student views)
- [ ] Implement Student Sign Up screen
- [ ] Implement Teacher Dashboard screen
- [ ] Implement Student Dashboard screen
- [ ] Implement Create New Session popup
- [ ] Implement Lobby screen
- [ ] Implement Main Game - Guest Card screen
- [ ] Implement Game Stats Panel
- [ ] Implement Week Results Overlay
- [ ] Implement Final Results screen
- [ ] Implement Educational Insights screen
- [ ] Implement Insights - Risk & Segment Reports
- [ ] Implement Insights - Patterns & Comparison
- [ ] Implement Insights - Lead Time & LOS Impact
- [ ] Connect all screens to backend via Socket.io + REST APIs

### Out of Scope

- Native mobile app — web-first, responsive later
- Leaderboard screens — explicitly removed from Stitch design ("No Leaderboard" variants)
- Admin panel — not in current design
- Real-time chat between students — not in scope

## Context

- **Backend:** Fully built Node.js/Express server with Socket.io, JWT auth, MySQL, Redis
- **Frontend design:** 15 screens in Stitch project `16500353157473194410` — "Claymorphism Hotel Management UI"
- **Design system:** Organic Brutalism (terracotta, block shadows, pill shapes, Plus Jakarta Sans)
- **Approach:** Implement one screen at a time, matching Stitch HTML/CSS exactly
- **Stack:** React 19, Vite 8, TailwindCSS 4, Zustand, Socket.io-client, Recharts, Axios

## Constraints

- **Design fidelity**: Must match Stitch designs exactly — Claymorphism aesthetic with block shadows, no blurs, no gradients
- **Tech stack**: React 19 + Vite 8 + TailwindCSS 4 (already scaffolded in `hotel-game/frontend/`)
- **Backend compatibility**: Must integrate with existing Socket.io events and REST API endpoints
- **Education context**: BTP (Bachelor's Thesis Project)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Claymorphism design system | Pre-designed in Stitch with 15 screens | — Pending |
| TailwindCSS 4 for styling | Already installed in frontend scaffold | — Pending |
| Zustand for state management | Lightweight, already installed | — Pending |
| Screen-by-screen implementation | User preference for incremental progress | — Pending |
| No leaderboard screens | Explicitly excluded in Stitch design variants | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-07 after initialization*
