# Roadmap: Hotel Revenue Management Game — v1.1 Pricing Strategy Pivot

**Created:** 2026-04-07
**Milestone:** v1.1 — Pricing Strategy Pivot
**Phases:** 5 | **Requirements:** 16

## Phase 8: Backend Pricing Engine

**Goal:** Replace the accept/reject decision flow with a pricing submission + demand simulation engine. Student submits prices per room tier, backend generates guests, auto-resolves bookings, calculates revenue.

**Requirements:** PRICE-01, PRICE-02, PRICE-03, FLOW-01, FLOW-02, FLOW-03

**UI hint**: no

**Success Criteria:**
1. `player:submit_prices` socket event accepts `{ standard, mid, premium, suite }` prices and stores them
2. Backend generates guests for the week, auto-books each guest whose ADR ≥ player price for their room tier
3. Cancellations and no-shows are applied to booked guests using existing ML probabilities
4. `week:results` event emits revenue, occupancy, guests_booked, guests_turned_away, adr_achieved per tier
5. Week advances correctly through configurable total_weeks with varying demand levels
6. Full game loop works: prices → simulate → results → next week → ... → game:completed

**Files to modify:**
- `backend/src/socket/handlers/gameHandler.js` — new `player:submit_prices` event
- `backend/src/socket/handlers/decisionHandler.js` — remove/replace with pricing handler
- `backend/src/services/decisionService.js` — replace with `pricingService.js`
- `backend/src/game/weekOrchestrator.js` — refactor week flow for pricing mechanic
- `backend/src/services/weekResolutionService.js` — adapt for auto-booked guests

---

## Phase 9: Pricing UI — Game Screen Refactor

**Goal:** Replace the guest card + accept/reject UI with a pricing interface. Show room tiers, price inputs, inventory, and submit button.

**Requirements:** UI-01, UI-02, UI-03

**UI hint**: yes

**Success Criteria:**
1. GamePage shows 4 room tier cards with price input fields (slider + number input)
2. Suggested price range shown per tier based on demand level hint
3. Room availability grid displays current inventory (rooms per tier per day)
4. Submit button emits `player:submit_prices` and shows loading/simulation state
5. Claymorphism styling consistent with existing design system

**Depends on:** Phase 8

**Files to modify:**
- `frontend/src/pages/GamePage.jsx` — complete rewrite for pricing mechanic
- `frontend/src/components/PricingCard.jsx` — new component for each room tier
- `frontend/src/components/InventoryGrid.jsx` — extracted room grid component

---

## Phase 10: Week Results & Game Completion

**Goal:** Implement week results overlay showing simulation outcomes, and final results screen with cumulative performance.

**Requirements:** RES-01, RES-02, RES-03

**UI hint**: yes

**Success Criteria:**
1. Week results overlay shows: revenue earned, occupancy %, guests booked vs turned away, ADR per tier
2. Visual breakdown of which segments booked and which were priced out
3. Final results screen shows cumulative revenue, avg occupancy, and comparison to optimal strategy
4. Week-by-week history chart with Recharts (revenue + occupancy trend lines)
5. Auto-advance to next week or navigate to final results on game:completed

**Depends on:** Phase 9

**Files to modify:**
- `frontend/src/pages/GamePage.jsx` — add results overlay state
- `frontend/src/components/WeekResultsOverlay.jsx` — new component
- `frontend/src/pages/ResultsPage.jsx` — refactor for pricing-based metrics
- `frontend/src/components/RevenueTrendChart.jsx` — new Recharts component

---

## Phase 11: Leaderboard & Dashboard Polish

**Goal:** Wire up leaderboard with cumulative revenue ranking and polish dashboard for the pricing flow.

**Requirements:** INFRA-01, INFRA-02

**UI hint**: yes

**Success Criteria:**
1. Dashboard session cards show pricing-relevant stats (avg price set, revenue, occupancy)
2. Delete session button works with confirmation
3. Leaderboard page ranks all players by cumulative revenue
4. Leaderboard supports branch filtering

**Depends on:** Phase 10

**Files to modify:**
- `frontend/src/pages/Dashboard.jsx` — update session card stats
- `frontend/src/pages/LeaderboardPage.jsx` — polish and verify
- `backend/src/services/leaderboardService.js` — verify scoring

---

## Phase 12: Educational Insights & Analytics

**Goal:** Build post-game analytics screens that help students understand their pricing decisions — what worked, what didn't, and what optimal pricing would have looked like.

**Requirements:** INS-01, INS-02, INS-03

**UI hint**: yes

**Success Criteria:**
1. Pricing vs market WTP chart — player's prices overlaid on guest ADR distribution
2. Segment capture analysis — % of each segment captured at player's price points
3. Optimal pricing analysis — backend calculates revenue-maximizing prices, shows comparison
4. All charts use Recharts with Claymorphism styling
5. Accessible from results page and dashboard

**Depends on:** Phase 10

**Files to modify:**
- `frontend/src/pages/InsightsPage.jsx` — refactor for pricing analytics
- `backend/src/routes/sessions.js` — add endpoint for optimal pricing calculation
- `frontend/src/components/PricingComparisonChart.jsx` — new chart
- `frontend/src/components/SegmentCaptureChart.jsx` — new chart

---

## Summary

| # | Phase | Requirements | Depends On |
|---|-------|-------------|------------|
| 8 | Backend Pricing Engine | PRICE-01, PRICE-02, PRICE-03, FLOW-01, FLOW-02, FLOW-03 | — |
| 9 | Pricing UI — Game Screen Refactor | UI-01, UI-02, UI-03 | Phase 8 |
| 10 | Week Results & Game Completion | RES-01, RES-02, RES-03 | Phase 9 |
| 11 | Leaderboard & Dashboard Polish | INFRA-01, INFRA-02 | Phase 10 |
| 12 | Educational Insights & Analytics | INS-01, INS-02, INS-03 | Phase 10 |

## Requirement Coverage

All 16 requirements mapped. No gaps.

| REQ-ID | Phase |
|--------|-------|
| PRICE-01 | 8 |
| PRICE-02 | 8 |
| PRICE-03 | 8 |
| FLOW-01 | 8 |
| FLOW-02 | 8 |
| FLOW-03 | 8 |
| UI-01 | 9 |
| UI-02 | 9 |
| UI-03 | 9 |
| RES-01 | 10 |
| RES-02 | 10 |
| RES-03 | 10 |
| INFRA-01 | 11 |
| INFRA-02 | 11 |
| INS-01 | 12 |
| INS-02 | 12 |
| INS-03 | 12 |
