# External Integrations

## Databases

### MySQL (via Sequelize ORM)

- **Config:** `hotel-game/backend/src/config/db.js`
- **Connection:** Host/port/name/user/password from environment variables
- **Pool:** min 2, max 10 connections
- **Migrations:** 10 migration files in `src/db/migrations/` (001–010)
- **Tables:** users, game_sessions, session_players, player_states, weeks, bookings, weekly_scores

### Redis (via ioredis)

- **Config:** `hotel-game/backend/src/config/redis.js`
- **Connection:** Single `REDIS_URL` from environment
- **Key schema:** Defined in `src/config/redisKeys.js`
  - `session:{id}:state` — game state JSON (status, currentWeek, currentGuestIndex, weekId)
  - `session:{id}:week:{n}:guest:{i}:decisions` — player decisions per guest
  - `session:{id}:player:{userId}:rooms` — room inventory + 7-day calendar
  - `session:{id}:playerCount` — cached player count
  - `session:{id}:week:{n}:guestTimer` — guest decision timer
  - `session:{id}:week:{n}:currentGuest` — current guest index
- **TTL:** All keys expire after 7200 seconds (2 hours)
- **Transactions:** WATCH/MULTI used for atomic room inventory updates

## Internal Service Communication

### Profile Service (Python FastAPI → Node.js Backend)

- **URL:** `PROFILE_SERVICE_URL` env var (default: `http://localhost:8000`)
- **Timeout:** `PROFILE_SERVICE_TIMEOUT_MS` env var (default: 5000ms)
- **Endpoints consumed:**
  - `POST /generate-guests` — Generate N guest profiles with CTGAN + LightGBM
  - `GET /health` — Health check with model metadata
- **Fallback:** If profile service is unavailable, backend falls back to statistical sampling + ONNX inference
- **Called from:** `hotel-game/backend/src/demand/guestFactory.js`

## Real-time Communication

### Socket.io (Backend ↔ Frontend)

- **Server:** `hotel-game/backend/src/socket/index.js`
- **Auth:** JWT token via `socket.handshake.auth.token`
- **Namespace:** Default namespace
- **Rooms:** `session:{sessionId}` for game session grouping
- **Events emitted (server → client):**
  - `game:started`, `game:completed`
  - `week:started`, `week:resolving`, `week:results`
  - `guest:arrived`, `guest:expired`
  - `decision:confirmed`, `decision:error`
  - `lobby:player_joined`, `lobby:player_left`
- **Events received (client → server):**
  - `player:decision` — accept/reject guest with room tier
  - `lobby:join`, `lobby:ready`
  - `game:start`, `game:advance_week`

## Authentication

### JWT

- **Secret:** `JWT_SECRET` from environment
- **REST middleware:** `src/middleware/auth.js` — Bearer token in Authorization header
- **Socket middleware:** JWT verification in `socket.handshake.auth.token`
- **Password hashing:** bcryptjs

## ML Model Artifacts

### ONNX Models (Fallback Path)

- **Location:** `hotel-game/backend/models/`
- **Models:** `adr_model_city.onnx`, `adr_model_resort.onnx`, `cancel_model.onnx`, `noshow_model.onnx`
- **Loaded by:** `src/demand/modelLoader.js` using `onnxruntime-node`
- **Used only when:** Python profile service is unavailable

### JSON Config Files

- **Location:** `hotel-game/backend/models/`
- **Files:** `volume_params.json`, `profile_params.json`, `upgrade_delta.json`, `pipeline_config.json`
- **Always loaded** at startup regardless of profile service availability

## External Data

### Hotel Revenue Historical Dataset

- **File:** `hotel_revenue_historical_full.xlsx` (18 MB)
- **Used by:** `demand_model/` training pipeline
- **Not used at runtime** — only for training
