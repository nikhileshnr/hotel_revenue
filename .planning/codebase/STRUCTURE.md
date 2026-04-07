# Directory Structure

## Top-Level Layout

```
e:\BTP\
├── hotel-game/                    # Main application
│   ├── backend/                   # Node.js game server
│   └── frontend/                  # React SPA (scaffold only)
├── demand_model/                  # ML training pipeline (Python)
├── profile-service/               # FastAPI guest profile microservice
├── hotel_revenue_historical_full.xlsx  # Training dataset (18 MB)
├── PROJECT_REPORT.md              # Project documentation
├── PPT_CONTENT.md                 # Presentation content
├── BACKEND_VERIFICATION_RESULTS.md # Verification results
├── backend_verification_plan.md   # Verification plan
├── backend_walkthrough.md         # Backend walkthrough
└── .planning/                     # GSD planning directory
    └── codebase/                  # This codebase map
```

## Backend Structure — `hotel-game/backend/`

```
hotel-game/backend/
├── src/
│   ├── server.js                  # App entry point
│   ├── config/
│   │   ├── db.js                  # Sequelize MySQL connection
│   │   ├── redis.js               # ioredis connection
│   │   ├── redisKeys.js           # Redis key schema
│   │   └── sequelize-cli.js       # Sequelize CLI config
│   ├── db/
│   │   └── migrations/            # 10 Sequelize migrations (001–010)
│   ├── demand/
│   │   ├── modelLoader.js         # Loads JSON + ONNX models at startup
│   │   ├── guestFactory.js        # Guest generation (CTGAN primary + ONNX fallback)
│   │   ├── profileSampler.js      # Statistical profile sampling
│   │   ├── adrPredictor.js        # ADR prediction via ONNX
│   │   └── riskPredictor.js       # Cancel/no-show risk via ONNX
│   ├── game/
│   │   ├── weekOrchestrator.js    # Game flow: start → weeks → resolution → end
│   │   └── guestTimerManager.js   # Timed guest release with timeouts
│   ├── middleware/
│   │   └── auth.js                # JWT Bearer token middleware
│   ├── repositories/
│   │   ├── userRepository.js      # User CRUD
│   │   ├── sessionRepository.js   # Game session CRUD
│   │   ├── bookingRepository.js   # Booking CRUD
│   │   ├── playerStateRepository.js # Player state tracking
│   │   ├── weekRepository.js      # Week records
│   │   └── weeklyScoreRepository.js # Per-week score tracking
│   ├── routes/
│   │   ├── auth.js                # /api/auth (register, login)
│   │   └── sessions.js            # /api/sessions (CRUD, listing)
│   ├── services/
│   │   ├── authService.js         # Register/login logic
│   │   ├── gameService.js         # Game validation & state transitions
│   │   ├── sessionService.js      # Session management
│   │   ├── decisionService.js     # Accept/reject guest logic
│   │   ├── roomInventoryService.js # LOS-aware room inventory
│   │   ├── leaderboardService.js  # Leaderboard computation
│   │   └── weekResolutionService.js # Booking outcome resolution
│   ├── socket/
│   │   ├── index.js               # Socket.io init + JWT auth middleware
│   │   └── handlers/
│   │       ├── lobbyHandler.js    # Lobby join/ready/leave events
│   │       ├── gameHandler.js     # Game start/advance events
│   │       └── decisionHandler.js # Player decision events
│   └── utils/
│       └── AppError.js            # Custom error class
├── models/                        # ML model artifacts (JSON + ONNX)
├── test_socket.mjs                # Socket.io integration test script
├── .env                           # Environment variables
├── .sequelizerc                   # Sequelize CLI paths config
└── package.json
```

## Frontend Structure — `hotel-game/frontend/`

```
hotel-game/frontend/
├── src/
│   ├── main.jsx                   # React entry point
│   ├── App.jsx                    # ⚠️ Default Vite scaffold
│   ├── App.css                    # Default styles
│   ├── index.css                  # Global styles
│   └── assets/                    # Static assets
├── vite.config.js                 # Vite + React plugin
├── eslint.config.js               # ESLint config
└── package.json
```

## Demand Model — `demand_model/`

```
demand_model/
├── src/
│   ├── 01_load_and_clean.py       # Data loading & cleaning
│   ├── 02_feature_engineering.py  # Feature engineering
│   ├── 03_train_volume_model.py   # Booking volume parameters
│   ├── 04_train_profile_model.py  # Guest profile distributions
│   ├── 05_train_adr_model.py      # ADR prediction (LightGBM)
│   ├── 06_train_cancel_model.py   # Cancellation prediction
│   ├── 07_train_upgrade_model.py  # Room upgrade delta
│   ├── 08_validate_pipeline.py    # End-to-end validation
│   ├── 09_train_ctgan.py          # CTGAN synthetic data model
│   └── 10_evaluate_ctgan.py       # CTGAN quality evaluation
├── data/                          # Intermediate data files
├── models/                        # Trained model artifacts
├── notebooks/                     # Jupyter notebooks
├── Screenshots/                   # Training screenshots
├── TRAINING_REPORT.md             # Training documentation
├── requirements.txt               # Python dependencies
└── venv/                          # Python virtual environment
```

## Profile Service — `profile-service/`

```
profile-service/
├── main.py                        # FastAPI app (endpoints)
├── generator.py                   # CTGAN model wrapper
├── adr_predictor.py               # ADR LightGBM inference
├── risk_predictor.py              # Risk LightGBM inference
├── postprocess.py                 # Raw → clean profile processing
├── requirements.txt               # Python dependencies
└── .env                           # Environment variables
```

## Naming Conventions

| Convention | Example |
|-----------|---------|
| Files | camelCase for JS (`gameService.js`), snake_case for Python (`adr_predictor.py`) |
| Directories | lowercase (`services/`, `repositories/`) |
| Migrations | Numbered prefix (`001-create-users.js`) |
| Redis keys | Colon-separated namespaces (`session:{id}:state`) |
