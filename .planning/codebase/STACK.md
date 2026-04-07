# Technology Stack

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

10 training scripts (`01_load_and_clean.py` → `10_evaluate_ctgan.py`) producing:
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
