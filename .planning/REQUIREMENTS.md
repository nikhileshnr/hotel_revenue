# Requirements: Hotel Revenue Management Game — Frontend

**Defined:** 2026-04-07
**Core Value:** Students can play through a complete hotel revenue management simulation with real-time guest decisions, seeing consequences through detailed analytics

## v1 Requirements

Requirements for React frontend implementation. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: App has routing (React Router) with auth-protected routes
- [ ] **FOUND-02**: App uses Zustand store for auth state (JWT token, user info)
- [ ] **FOUND-03**: App uses Socket.io-client connected with JWT auth
- [ ] **FOUND-04**: App implements Claymorphism design system (block shadows, pill shapes, terracotta palette, Plus Jakarta Sans)
- [ ] **FOUND-05**: API utility module wraps Axios with base URL + auth headers

### Authentication

- [ ] **AUTH-01**: Teacher can view landing page and log in
- [ ] **AUTH-02**: Student can view landing page and log in
- [ ] **AUTH-03**: Student can sign up with name, email, password
- [ ] **AUTH-04**: Auth state persists across browser refresh (JWT in localStorage)

### Dashboard

- [ ] **DASH-01**: Teacher can view dashboard with session list and quick actions
- [ ] **DASH-02**: Student can view dashboard with joined sessions and stats
- [ ] **DASH-03**: Teacher can create a new session via popup (hotel type, weeks, simulated month)

### Lobby

- [ ] **LOBBY-01**: Players see lobby with session info and connected players
- [ ] **LOBBY-02**: Teacher can start the game from lobby
- [ ] **LOBBY-03**: Real-time player join/leave updates via Socket.io

### Gameplay

- [ ] **GAME-01**: Player sees guest cards arriving one by one with all guest details
- [ ] **GAME-02**: Player can accept (with room tier selection) or reject each guest
- [ ] **GAME-03**: Player sees remaining room inventory (7-day calendar view)
- [ ] **GAME-04**: Game stats panel shows live revenue, occupancy, decisions made
- [ ] **GAME-05**: Decision confirmations update UI in real-time

### Results

- [ ] **RES-01**: Week results overlay shows per-player stats (revenue, cancellations, no-shows, occupancy)
- [ ] **RES-02**: Teacher can advance to next week from results screen
- [ ] **RES-03**: Final results screen shows comprehensive game summary with all weeks

### Insights

- [ ] **INS-01**: Educational insights page with key learning summaries
- [ ] **INS-02**: Risk & segment analysis with charts and breakdowns
- [ ] **INS-03**: Pattern & comparison analysis across weeks/players
- [ ] **INS-04**: Lead time & LOS impact analysis with visualizations

## v2 Requirements

- **LEAD-01**: Persistent leaderboard across sessions
- **RESP-01**: Responsive mobile layout
- **NOTIF-01**: In-app notifications for session invites
- **EXPORT-01**: Export game results as CSV/PDF

## Out of Scope

| Feature | Reason |
|---------|--------|
| Leaderboard screens | Explicitly excluded in Stitch design variants |
| Admin panel | Not in current design |
| Real-time chat | High complexity, not core to learning |
| Native mobile app | Web-first approach |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| LOBBY-01 | Phase 4 | Pending |
| LOBBY-02 | Phase 4 | Pending |
| LOBBY-03 | Phase 4 | Pending |
| GAME-01 | Phase 5 | Pending |
| GAME-02 | Phase 5 | Pending |
| GAME-03 | Phase 5 | Pending |
| GAME-04 | Phase 5 | Pending |
| GAME-05 | Phase 5 | Pending |
| RES-01 | Phase 6 | Pending |
| RES-02 | Phase 6 | Pending |
| RES-03 | Phase 6 | Pending |
| INS-01 | Phase 7 | Pending |
| INS-02 | Phase 7 | Pending |
| INS-03 | Phase 7 | Pending |
| INS-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-07*
*Last updated: 2026-04-07 after initial definition*
