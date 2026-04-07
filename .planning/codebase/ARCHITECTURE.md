# Architecture

## System Overview

A **multiplayer hotel revenue management simulation game** built as a real-time web application with ML-powered demand generation.

```
┌─────────────────┐     HTTP/WS      ┌─────────────────┐     HTTP      ┌──────────────────┐
│  React Frontend │ ◄──────────────► │  Node.js Backend │ ──────────► │  Python Profile  │
│  (Vite + Zustand)│                 │  (Express + S.io)│             │  Service (FastAPI)│
└─────────────────┘                  └────────┬────────┘             └──────────────────┘
                                              │                              │
                                    ┌─────────┼─────────┐                   │
                                    │         │         │                   │
                                ┌───▼───┐ ┌───▼───┐ ┌───▼───┐     ┌───────▼────────┐
                                │ MySQL │ │ Redis │ │ ONNX  │     │ CTGAN+LightGBM │
                                │(perm) │ │(ephem)│ │(fallb)│     │   (primary)    │
                                └───────┘ └───────┘ └───────┘     └────────────────┘
```

## Architectural Pattern

**Layered monolith** (backend) with **microservice sidecar** (profile-service):

1. **Routes** → HTTP endpoints (Express router)
2. **Socket Handlers** → Real-time event handlers (Socket.io)
3. **Services** → Business logic
4. **Repositories** → Database access (Sequelize)
5. **Config** → Database, Redis, environment

## Component Architecture

### Backend Layers (`hotel-game/backend/src/`)

| Layer | Files | Responsibility |
|-------|-------|---------------|
| **Entry** | `server.js` | App bootstrap, DB/Redis/ONNX init, Socket.io init |
| **Routes** | `routes/auth.js`, `routes/sessions.js` | REST API endpoints |
| **Socket** | `socket/index.js`, `socket/handlers/*.js` | WebSocket events (lobby, game, decision) |
| **Services** | `services/*.js` (6 files) | Business logic — auth, game, decision, leaderboard, room inventory, week resolution |
| **Game** | `game/weekOrchestrator.js`, `game/guestTimerManager.js` | Game flow orchestration, timed guest release |
| **Demand** | `demand/*.js` (5 files) | ML inference — model loading, guest generation, ADR/risk prediction, profile sampling |
| **Repositories** | `repositories/*.js` (6 files) | Data access — user, session, booking, playerState, week, weeklyScore |
| **Middleware** | `middleware/auth.js` | JWT authentication middleware |
| **Config** | `config/*.js` (4 files) | DB, Redis, Redis key schema, Sequelize CLI config |
| **Utils** | `utils/AppError.js` | Custom error class |

### Frontend (`hotel-game/frontend/src/`)

| Component | Status |
|-----------|--------|
| `App.jsx` | ⚠️ Default Vite scaffold — **not implemented yet** |
| State management | Zustand installed but not configured |
| Routing | react-router-dom installed but not configured |
| Charts | Recharts installed but not used |

### Profile Service (`profile-service/`)

| File | Responsibility |
|------|---------------|
| `main.py` | FastAPI app — `/generate-guests` and `/health` endpoints |
| `generator.py` | CTGAN model loading and raw profile generation |
| `adr_predictor.py` | LightGBM ADR prediction |
| `risk_predictor.py` | LightGBM cancellation/no-show risk prediction |
| `postprocess.py` | Raw CTGAN output → clean guest profile |

### Demand Model Pipeline (`demand_model/src/`)

10 sequential training scripts producing JSON configs and ONNX models.

## Data Flow

### Game Session Lifecycle

```
1. Teacher creates session → MySQL (game_sessions)
2. Players join lobby → Socket.io room + MySQL (session_players)
3. Teacher starts game → Redis state + MySQL status update
4. Each week:
   a. Generate guests → Profile Service (CTGAN) or ONNX fallback
   b. Release guests one-by-one → Socket.io timed events
   c. Players decide (accept/reject) → Redis decisions + MySQL bookings
   d. Week resolution → Monte Carlo (cancel/no-show) → MySQL scores
5. Game ends → Final leaderboard → MySQL status update
```

### Guest Generation (Dual-Path)

```
Primary:   guestFactory.js → HTTP POST → profile-service → CTGAN+LightGBM → guest profiles
Fallback:  guestFactory.js → profileSampler.js → ONNX models → guest profiles
```

### Room Inventory Management

```
Redis stores per-player 7-day calendar per room tier
WATCH/MULTI for atomic updates (prevents double-booking)
LOS-aware: blocks rooms across arrival_day through arrival_day+LOS
```

## Entry Points

| Entry Point | File | How to Start |
|-------------|------|-------------|
| Backend server | `hotel-game/backend/src/server.js` | `npm run dev` |
| Frontend dev | `hotel-game/frontend/` | `npm run dev` |
| Profile service | `profile-service/main.py` | `uvicorn main:app` |
| Training pipeline | `demand_model/src/01_load_and_clean.py` | Sequential execution |
