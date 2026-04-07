# Requirements: Hotel Revenue Management Game — v1.1 Pricing Strategy Pivot

**Created:** 2026-04-07
**Milestone:** v1.1 — Pricing Strategy Pivot
**Total Requirements:** 16

## Backend — Pricing Engine

- [ ] **PRICE-01**: Student can submit room prices ($/night) for each of 4 room tiers before a week starts
- [ ] **PRICE-02**: Backend simulates demand — each generated guest auto-books if player price ≤ guest ADR (willingness to pay), skips otherwise
- [ ] **PRICE-03**: Backend resolves week outcomes: cancellations, no-shows applied to booked guests, final revenue calculated

## Game Flow

- [ ] **FLOW-01**: Game progresses through configurable number of weeks (default 20)
- [ ] **FLOW-02**: Each week has a demand level (low/medium/high) that affects guest volume and ADR distribution
- [ ] **FLOW-03**: Week lifecycle: set prices → submit → simulation runs → results displayed → next week

## Frontend — Pricing UI

- [ ] **UI-01**: Pricing screen shows 4 room tiers with price input sliders/fields and suggested price ranges
- [ ] **UI-02**: Room availability grid shows current inventory before pricing
- [ ] **UI-03**: Submit button locks in prices and triggers week simulation

## Frontend — Results

- [ ] **RES-01**: Week results overlay shows: revenue earned, occupancy rate, guests turned away (priced out), ADR achieved
- [ ] **RES-02**: Final results screen shows cumulative revenue, average occupancy, ranking vs optimal strategy
- [ ] **RES-03**: Week-by-week history with trend charts (revenue, occupancy over time)

## Analytics & Insights

- [ ] **INS-01**: Post-game insights show pricing vs market willingness-to-pay comparison
- [ ] **INS-02**: Segment breakdown — which market segments were captured/lost at each price point
- [ ] **INS-03**: Optimal pricing analysis — what prices would have maximized revenue

## Infrastructure

- [ ] **INFRA-01**: Dashboard shows sessions with continue/view results/delete
- [ ] **INFRA-02**: Leaderboard ranks players by cumulative revenue across sessions

## Out of Scope

- Accept/reject individual guest mechanic — replaced by pricing strategy
- Timer-based guest decisions — replaced by strategic pricing phase
- Teacher-controlled lobbies — self-service student architecture
- Native mobile app
- Real-time chat

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| PRICE-01 | — | Pending |
| PRICE-02 | — | Pending |
| PRICE-03 | — | Pending |
| FLOW-01 | — | Pending |
| FLOW-02 | — | Pending |
| FLOW-03 | — | Pending |
| UI-01 | — | Pending |
| UI-02 | — | Pending |
| UI-03 | — | Pending |
| RES-01 | — | Pending |
| RES-02 | — | Pending |
| RES-03 | — | Pending |
| INS-01 | — | Pending |
| INS-02 | — | Pending |
| INS-03 | — | Pending |
| INFRA-01 | — | Pending |
| INFRA-02 | — | Pending |

---
*Last updated: 2026-04-07*
