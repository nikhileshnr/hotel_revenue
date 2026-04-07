# Hotel Revenue Management Game

## What This Is

An educational simulation game where students compete as hotel revenue managers, setting room prices each week and watching demand respond. The game teaches pricing strategy, demand forecasting, and revenue optimization through a multi-week simulation with ML-generated market demand. The frontend uses a Claymorphism ("Organic Brutalism") design.

## Core Value

Students learn revenue management by setting room prices and observing how the market responds — pricing too high means empty rooms, too low means lost revenue. Each week's demand is driven by ML models, creating realistic market behavior.

## Current Milestone: v1.1 Pricing Strategy Pivot

**Goal:** Pivot core gameplay from accept/reject individual guests to a pricing strategy mechanic where students set room prices, demand auto-simulates, and revenue is determined by market response.

**Target features:**
- Pricing interface — set $/night for each room tier before each week
- Demand simulation — backend auto-matches generated guests against player prices
- Week results — revenue, occupancy, demand lost, rooms empty
- Multi-week progression with varying demand levels
- Analytics & insights — pricing decisions vs optimal pricing
- Dashboard & session management (existing, adapted)

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Backend game engine — auth, sessions, Socket.io, game logic — existing
- ✓ Demand model pipeline — CTGAN + LightGBM trained models — existing
- ✓ Profile service — FastAPI guest generation microservice — existing
- ✓ Database schema — 10 migrations, 7 tables — existing
- ✓ Room inventory — LOS-aware calendar system in Redis — existing
- ✓ Frontend scaffold — React 19, Vite 8, TailwindCSS 4, auth screens, dashboard — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Pricing interface — students set prices per room tier per week
- [ ] Demand simulation engine — auto-resolve guest bookings based on price vs willingness-to-pay
- [ ] Week results display — revenue, occupancy, lost demand breakdown
- [ ] Multi-week game loop — progression through weeks with demand variation
- [ ] Final results & leaderboard — cumulative performance ranking
- [ ] Educational insights — pricing analytics, optimal pricing comparison
- [ ] Backend refactor — replace accept/reject decision flow with pricing submission + simulation

### Out of Scope

- Native mobile app — web-first
- Admin panel — not in current design
- Real-time chat between students — not in scope
- Accept/reject individual guest mechanic — replaced by pricing strategy
- Timer-based guest decisions — replaced by strategic pricing phase

## Context

- **Backend:** Fully built Node.js/Express server with Socket.io, JWT auth, MySQL, Redis
- **Frontend:** React 19, Vite 8, TailwindCSS 4 with auth screens, dashboard, game page (needs refactor)
- **Design system:** Claymorphism (terracotta, block shadows, pill shapes, Plus Jakarta Sans)
- **ML Pipeline:** CTGAN guest generator + LightGBM ADR/risk models — guests have willingness-to-pay (ADR)
- **Key insight:** Guest ADR from ML pipeline becomes the price sensitivity threshold for the simulation

## Constraints

- **Design fidelity**: Claymorphism aesthetic with block shadows, no blurs, no gradients
- **Tech stack**: React 19 + Vite 8 + TailwindCSS 4
- **Backend compatibility**: Reuse existing auth, sessions, Redis infrastructure
- **Education context**: BTP (Bachelor's Thesis Project)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Pivot to pricing strategy | More educational — teaches pricing optimization vs binary accept/reject | — Active |
| Guest ADR = willingness to pay | CTGAN already generates realistic ADR — reuse as price sensitivity | — Active |
| Keep existing infrastructure | Auth, sessions, Redis, Socket.io all still needed | — Active |
| Remove timer-based decisions | Pricing is a strategic, not time-pressured, activity | — Active |

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
*Last updated: 2026-04-07 after milestone v1.1 pivot*
