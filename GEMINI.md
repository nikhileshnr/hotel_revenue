<!-- GSD:project-start source:PROJECT.md -->
## Project

**Hotel Revenue Management Game**

A multiplayer educational simulation game where students compete as hotel revenue managers, making real-time decisions on guest bookings while learning about demand forecasting, pricing strategy, and risk management. Teachers create sessions, students join lobbies, and compete across multiple weeks with ML-generated guest profiles. The frontend uses a Claymorphism ("Organic Brutalism") design from Stitch.

**Core Value:** Students can play through a complete hotel revenue management simulation with real-time guest decisions, seeing the consequences of their choices through detailed analytics and insights.

### Constraints

- **Design fidelity**: Must match Stitch designs exactly — Claymorphism aesthetic with block shadows, no blurs, no gradients
- **Tech stack**: React 19 + Vite 8 + TailwindCSS 4 (already scaffolded in `hotel-game/frontend/`)
- **Backend compatibility**: Must integrate with existing Socket.io events and REST API endpoints
- **Education context**: BTP (Bachelor's Thesis Project)
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages & Runtimes
| Language | Version | Usage |
|----------|---------|-------|
| JavaScript (Node.js) | Node 18+ (CommonJS) | Backend game server |
| JavaScript (ES Modules) | Vite 8 + React 19 | Frontend SPA |
| Python | 3.10+ | ML training pipeline + profile microservice |
## Backend — `hotel-game/backend/`
### Frameworks & Core Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| express | ^5.2.1 | HTTP server & REST API |
| socket.io | ^4.8.3 | Real-time WebSocket communication |
| sequelize | ^6.37.8 | MySQL ORM with migrations |
| mysql2 | ^3.20.0 | MySQL driver |
| ioredis | ^5.10.0 | Redis client for game state caching |
| jsonwebtoken | ^9.0.3 | JWT authentication |
| bcryptjs | ^3.0.3 | Password hashing |
| onnxruntime-node | ^1.24.3 | ONNX model inference (statistical fallback) |
| dotenv | ^17.3.1 | Environment variable loading |
| cors | ^2.8.6 | CORS middleware |
| uuid | ^13.0.0 | UUID generation |
### Dev Dependencies
| Library | Version | Purpose |
|---------|---------|---------|
| nodemon | ^3.1.14 | Auto-restart dev server |
| sequelize-cli | ^6.6.5 | Database migration tooling |
### Configuration
- **Module system:** CommonJS (`"type": "commonjs"`)
- **Entry point:** `src/server.js`
- **Scripts:** `dev` (nodemon), `start` (node), `migrate`, `migrate:rollback`, `migrate:make`
- **Environment:** `.env` file with DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, REDIS_URL, FRONTEND_URL, PROFILE_SERVICE_URL
## Frontend — `hotel-game/frontend/`
### Frameworks & Core Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.4 | UI framework |
| react-dom | ^19.2.4 | React DOM renderer |
| react-router-dom | ^7.13.1 | Client-side routing |
| recharts | ^3.8.0 | Data visualization / charts |
| socket.io-client | ^4.8.3 | WebSocket client |
| zustand | ^5.0.12 | Lightweight state management |
| axios | ^1.13.6 | HTTP client |
### Dev Dependencies
| Library | Version | Purpose |
|---------|---------|---------|
| vite | ^8.0.0 | Build tool + dev server |
| @vitejs/plugin-react | ^6.0.0 | React Fast Refresh |
| tailwindcss | ^4.2.2 | CSS framework |
| @tailwindcss/vite | ^4.2.2 | Tailwind Vite integration |
| eslint | ^9.39.4 | Linting |
### Configuration
- **Module system:** ES Modules (`"type": "module"`)
- **Build:** Vite with React plugin
- **Status:** ⚠️ Still default Vite scaffold — no custom UI implemented yet
## Demand Model — `demand_model/`
### Python Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| pandas | 2.2.2 | Data manipulation |
| numpy | 1.26.4 | Numerical computation |
| scikit-learn | 1.5.0 | ML preprocessing & auxiliary models |
| lightgbm | 4.3.0 | Gradient boosting (ADR, cancel, no-show models) |
| scipy | 1.13.0 | Statistical functions |
| statsmodels | 0.14.2 | Statistical modeling |
| openpyxl | 3.1.2 | Excel file reading |
| joblib | 1.4.2 | Model serialization |
| onnxmltools | 1.12.0 | ONNX model conversion |
| skl2onnx | 1.16.0 | Sklearn-to-ONNX conversion |
| onnxruntime | 1.18.0 | ONNX model validation |
### Pipeline Structure
- JSON config files: `volume_params.json`, `profile_params.json`, `upgrade_delta.json`, `pipeline_config.json`
- ONNX models: `adr_model_city.onnx`, `adr_model_resort.onnx`, `cancel_model.onnx`, `noshow_model.onnx`
- CTGAN model: synthesized guest profiles
## Profile Service — `profile-service/`
### Python Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| fastapi | latest | REST API microservice |
| uvicorn | latest | ASGI server |
| sdv | latest | Synthetic Data Vault (CTGAN) |
| lightgbm | latest | ADR & risk prediction |
| joblib | latest | Model loading |
| pandas / numpy / scikit-learn | latest | Data processing |
| python-dotenv | latest | Environment config |
## Databases & Data Stores
| Store | Usage |
|-------|-------|
| **MySQL** | Persistent data — users, game sessions, players, bookings, scores |
| **Redis** | Ephemeral game state — session state, room inventory calendars, guest timers, decision tracking |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## JavaScript (Backend)
### Module System
- **CommonJS** (`require`/`module.exports`) throughout backend
- No TypeScript — vanilla JavaScript only
### File Naming
- **camelCase** for all JS files: `gameService.js`, `weekOrchestrator.js`
- **Numbered prefix** for migrations: `001-create-users.js`, `010-add-expected-value-to-bookings.js`
### Code Style
- `const` preferred over `let`; `var` not used
- Arrow functions for callbacks and inline functions
- `async/await` throughout — no raw Promise chains
- Destructuring used for imports and function parameters
- Console logging with bracketed prefixes: `[Server]`, `[Redis]`, `[ModelLoader]`, `[Socket]`, `[guestFactory]`
### Error Handling
- Custom `AppError` class (`src/utils/AppError.js`) with `message` and `statusCode`
- Services throw `AppError` for business logic errors
- Global Express error handler catches all unhandled errors
- Socket handlers wrap in try/catch, emit `decision:error` on failure
- Model loading failures are fatal (server exits with `process.exit(1)`)
- Profile service failures are non-fatal (fallback to statistical path)
### Repository Pattern
- One repository file per database table (`userRepository.js`, `sessionRepository.js`, etc.)
- Repositories encapsulate raw Sequelize queries
- Services never access Sequelize directly — always go through repositories
- Pattern: `repository.findById()`, `repository.insert()`, `repository.updateStatus()`
### Service Pattern
- One service per domain concern: `authService`, `gameService`, `decisionService`, etc.
- Services contain business logic and validation
- Services call repositories for data access
- Services throw `AppError` for validation failures
### Socket Handler Pattern
- One handler per domain: `lobbyHandler`, `gameHandler`, `decisionHandler`
- Each handler is a function `(io, socket) => { ... }` that registers event listeners
- Registered in `socket/index.js` after JWT authentication
### Redis Key Convention
- Centralized in `config/redisKeys.js`
- Pattern: `session:{id}:state`, `session:{id}:player:{userId}:rooms`
- All keys have 2-hour TTL (7200 seconds)
- WATCH/MULTI used for atomic operations on inventory
## Python (Profile Service & Training)
### File Naming
- **snake_case** for all Python files: `adr_predictor.py`, `risk_predictor.py`
- Numbered prefix for pipeline scripts: `01_load_and_clean.py`
### Code Style
- Type hints used in FastAPI models (Pydantic)
- Docstrings on main functions and modules
- `print()` with bracketed prefixes: `[startup]`, `[shutdown]`
### API Pattern (FastAPI)
- Pydantic `BaseModel` for request validation
- `asynccontextmanager` lifespan for model initialization
- `HTTPException` for error responses
- Version tracking in app metadata
## Configuration
### Environment Variables
- All sensitive config in `.env` files (not committed)
- `dotenv` loaded at startup (`require('dotenv').config()` / `load_dotenv()`)
- Reasonable defaults for optional values (e.g., `PROFILE_SERVICE_URL || 'http://localhost:8000'`)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```
```
## Architectural Pattern
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
## Data Flow
### Game Session Lifecycle
```
```
### Guest Generation (Dual-Path)
```
```
### Room Inventory Management
```
```
## Entry Points
| Entry Point | File | How to Start |
|-------------|------|-------------|
| Backend server | `hotel-game/backend/src/server.js` | `npm run dev` |
| Frontend dev | `hotel-game/frontend/` | `npm run dev` |
| Profile service | `profile-service/main.py` | `uvicorn main:app` |
| Training pipeline | `demand_model/src/01_load_and_clean.py` | Sequential execution |
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.agent/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
