# Roadmap: Hotel Revenue Management Game — Frontend

**Created:** 2026-04-07
**Milestone:** v1.0 — Complete Frontend
**Phases:** 7 | **Requirements:** 27

## Phase 1: Foundation & Design System

**Goal:** Set up routing, state management, API/socket utilities, and the Claymorphism design system as reusable CSS/components.

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05

**UI hint**: yes

**Success Criteria:**
1. React Router configured with public and protected route wrappers
2. Zustand auth store manages JWT token and user info
3. Socket.io-client connects with JWT and emits/receives test events
4. Claymorphism design tokens (colors, shadows, fonts, spacing) extracted from Stitch and available as CSS/Tailwind utilities
5. Axios API utility sends authenticated requests to backend

**Stitch Screens:** None (infrastructure phase — design tokens extracted from all screens)

---

## Phase 2: Authentication Screens

**Goal:** Implement Landing/Auth pages for Teacher and Student, plus Student Sign Up — matching Stitch designs exactly.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04

**UI hint**: yes

**Success Criteria:**
1. Teacher landing page matches Stitch "Landing / Auth - Teacher View" screen
2. Student landing page matches Stitch "Landing / Auth - Student View" screen
3. Student sign up form matches Stitch "Student Sign Up" screen
4. Login/register calls backend `/api/auth` and stores JWT in Zustand + localStorage

**Stitch Screens:**
- `97abf0af9e19468fa784e205e9928b0a` — Landing / Auth - Student View
- `be900d9e32ee4743a13b600ad1dc8199` — Landing / Auth - Teacher View
- `f96060cc70c34e5a9a57c216cead13d3` — Student Sign Up

---

## Phase 3: Dashboards & Session Management

**Goal:** Implement Teacher Dashboard, Student Dashboard, and Create Session popup — matching Stitch designs exactly.

**Requirements:** DASH-01, DASH-02, DASH-03

**UI hint**: yes

**Success Criteria:**
1. Teacher dashboard matches Stitch "Dashboard (No Leaderboard)" screen
2. Student dashboard matches Stitch "Student Dashboard" screen
3. Create session popup matches Stitch "Create New Session Popup" screen
4. Sessions list fetched from backend `/api/sessions`
5. Create session calls backend and navigates to lobby

**Stitch Screens:**
- `ddc50a9dc5c440ec812e4bf62959752d` — Dashboard (No Leaderboard)
- `869fe9ca226c4792b503c7526857876c` — Student Dashboard
- `0033640fbbb74639ac88b34178bfe260` — Create New Session Popup

---

## Phase 4: Lobby

**Goal:** Implement pre-game lobby where players see session info, connected players, and teacher can start the game.

**Requirements:** LOBBY-01, LOBBY-02, LOBBY-03

**UI hint**: yes

**Success Criteria:**
1. Lobby screen matches Stitch "Lobby (No Leaderboard)" screen
2. Socket.io events `lobby:join`, `lobby:player_joined`, `lobby:player_left` handled
3. Teacher sees "Start Game" button; students see waiting state
4. Game start redirects all players to game screen

**Stitch Screens:**
- `6e28357badca4171817e5e7e84625699` — Lobby (No Leaderboard)

---

## Phase 5: Core Gameplay

**Goal:** Implement the main game loop — guest cards arriving, player decisions (accept/reject), room inventory, and live stats.

**Requirements:** GAME-01, GAME-02, GAME-03, GAME-04, GAME-05

**UI hint**: yes

**Success Criteria:**
1. Guest card screen matches Stitch "Main Game - Guest Card" screen
2. Game stats panel matches Stitch "Game Stats Panel" screen
3. Guest cards display all profile data (room type, LOS, segment, ADR, risk badge)
4. Accept/reject with room tier selection sends `player:decision` Socket.io event
5. Room inventory calendar updates in real-time after decisions
6. Stats panel shows live revenue, occupancy rate, and decision counts

**Stitch Screens:**
- `ea64eeb82b8e4dafb1afc706d9aebbb1` — Main Game - Guest Card (Timer Removed)
- `825fbf53955b413a83a5e49d4a4412c1` — Game Stats Panel

---

## Phase 6: Results Screens

**Goal:** Implement week results overlay and final game results — matching Stitch designs exactly.

**Requirements:** RES-01, RES-02, RES-03

**UI hint**: yes

**Success Criteria:**
1. Week results overlay matches Stitch "Week Results Overlay" screen
2. Final results screen matches Stitch "Final Results (No Leaderboard)" screen
3. `week:results` Socket.io event populates results overlay
4. Teacher can advance week or view final results
5. `game:completed` event triggers final results screen

**Stitch Screens:**
- `a83451701bba46f2af9c172a3d56539f` — Week Results Overlay
- `a2e20a733c124eaf978d8c3d8be0ffb4` — Final Results (No Leaderboard)

---

## Phase 7: Educational Insights

**Goal:** Implement the 4 insights/analytics screens with charts and data visualizations using Recharts.

**Requirements:** INS-01, INS-02, INS-03, INS-04

**UI hint**: yes

**Success Criteria:**
1. Educational insights page matches Stitch "Educational Insights" screen
2. Risk & segment reports match Stitch "Insights - Risk & Segment Reports" screen
3. Patterns & comparison matches Stitch "Insights - Patterns & Comparison" screen
4. Lead time & LOS impact matches Stitch "Insights - Lead Time & LOS Impact" screen
5. Charts rendered with Recharts using Claymorphism styling

**Stitch Screens:**
- `9728057740664b418e90b332105da543` — Educational Insights
- `9d316741d6a442d6a42b364d9c43b476` — Insights - Risk & Segment Reports (Synced)
- `08802950198f42349e8180abfa1ff3d3` — Insights - Patterns & Comparison (Synced)
- `5e0cf73ae18d4a31b41f2fe62afc3fb1` — Insights - Lead Time & LOS Impact (Layout Fixed)

---

## Summary

| # | Phase | Requirements | Stitch Screens |
|---|-------|-------------|----------------|
| 1 | Foundation & Design System | 5 | 0 (tokens) |
| 2 | Authentication Screens | 4 | 3 |
| 3 | Dashboards & Session Management | 3 | 3 |
| 4 | Lobby | 3 | 1 |
| 5 | Core Gameplay | 5 | 2 |
| 6 | Results Screens | 3 | 2 |
| 7 | Educational Insights | 4 | 4 |
| **Total** | | **27** | **15** |
