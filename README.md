# Hotel Revenue Management Simulation Game

A web-based educational simulation game for hotel revenue management, powered by ML models trained on 261K+ real hotel booking records.

## Architecture

```
demand_model/       → Python ML training pipeline (LightGBM, CTGAN, statsmodels)
profile-service/    → FastAPI microservice for CTGAN guest generation
hotel-game/
  ├── backend/      → Node.js + Express + Socket.io + MySQL + Redis
  └── frontend/     → React 19 + Vite 8 + Zustand + Nivo Charts
```

## Setup After Cloning

### Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18 | Backend + Frontend |
| MySQL | 8.0+ | Game database |
| Redis | Latest | Session state + room inventory |
| Python | 3.10+ | Profile service (CTGAN inference) |

### Step 1: MySQL Database

```sql
CREATE DATABASE hotel_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 2: Backend

```bash
cd hotel-game/backend

# Create .env from example
cp .env.example .env
# Edit .env — set your MySQL password and a secure JWT secret

# Install dependencies
npm install

# Run database migrations (creates all tables)
npm run migrate

# Start backend server
npm run dev
# → Server listening on http://localhost:3000
```

### Step 3: Profile Service (Python)

```bash
cd profile-service

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env from example
cp .env.example .env

# Start the service
uvicorn main:app --reload --port 8000
# → Profile service on http://localhost:8000
# Note: First startup takes 45-60s to load CTGAN + LightGBM models
```

> **Note:** The profile service is optional. If it's not running, the backend automatically falls back to the Node.js ONNX-based statistical sampler.

### Step 4: Frontend

```bash
cd hotel-game/frontend

# Install dependencies
npm install

# Create .env from example (points to backend)
cp .env.example .env

# Start dev server
npm run dev
# → Frontend on http://localhost:5173
```

### Step 5: Start Playing

1. Open `http://localhost:5173` in your browser
2. Register a new account
3. Click **New Session** on the Dashboard
4. Choose hotel type (City/Resort), game mode (Classic/Pricing), and week count
5. Click **Launch** — the game starts immediately

## Redis

Make sure Redis is running before starting the backend:

```bash
# Windows (if installed as service):
redis-server

# Docker:
docker run -d -p 6379:6379 redis
```

## Project Structure

```
.
├── demand_model/                  # ML Training Pipeline
│   ├── src/                       # 10 Python training scripts
│   │   ├── 01_clean.py            # Data cleaning (261K → 199K records)
│   │   ├── 02_features.py         # Feature engineering (32 features)
│   │   ├── 03_volume.py           # Demand volume (Negative Binomial)
│   │   ├── 04_profiles.py         # Guest profile distributions
│   │   ├── 05_adr.py              # ADR prediction (LightGBM)
│   │   ├── 06_cancel.py           # Cancellation model (LightGBM + Platt)
│   │   ├── 07_noshow.py           # No-show model (LightGBM)
│   │   ├── 08_export.py           # Export to ONNX + JSON
│   │   └── 10_validate.py         # End-to-end validation
│   ├── models/                    # Trained model artifacts
│   │   ├── ctgan_model.pkl        # CTGAN generator (~20MB)
│   │   ├── cancel_model.pkl       # Calibrated cancellation model
│   │   ├── adr_model_city.pkl     # City hotel ADR predictor
│   │   ├── adr_model_resort.pkl   # Resort hotel ADR predictor
│   │   ├── *.onnx                 # ONNX fallback models
│   │   └── *.json                 # Config + parameters
│   ├── 09_train_ctgan_colab.ipynb # Colab notebook for GPU training
│   └── requirements.txt
│
├── hotel-game/
│   ├── backend/                   # Node.js Game Server
│   │   ├── src/
│   │   │   ├── config/            # DB + Redis connections
│   │   │   ├── db/migrations/     # Sequelize migrations
│   │   │   ├── demand/            # ML inference (ONNX + statistical)
│   │   │   ├── game/              # Game logic (weekOrchestrator, guestFactory)
│   │   │   ├── services/          # Business logic layer
│   │   │   ├── routes/            # REST API endpoints
│   │   │   ├── socket/            # Socket.io event handlers
│   │   │   └── middleware/        # JWT auth middleware
│   │   ├── models/                # ONNX model files for Node.js inference
│   │   ├── scripts/               # Utility scripts (start-all, seed)
│   │   └── .env.example
│   │
│   └── frontend/                  # React SPA
│       ├── src/
│       │   ├── pages/             # 8 page components
│       │   ├── components/        # Shared UI components
│       │   ├── stores/            # Zustand state management
│       │   └── lib/               # API + Socket.io clients
│       └── .env.example
│
├── profile-service/               # Python FastAPI Microservice
│   ├── main.py                    # FastAPI app + /generate endpoint
│   ├── generator.py               # CTGAN-based guest generation
│   ├── adr_predictor.py           # LightGBM ADR inference
│   ├── risk_predictor.py          # Cancel + no-show prediction
│   ├── postprocess.py             # Guest object assembly
│   └── requirements.txt
│
├── BTP_PROJECT_REPORT.tex         # LaTeX project report
└── README.md
```

## ML Models

All trained model files are included in the repository. No retraining needed.

| Model | File | Method | Key Metric |
|---|---|---|---|
| Demand Volume | `volume_params.json` | Negative Binomial | Seasonal [5–20] guests/week |
| Guest Profiles | `ctgan_model.pkl` | CTGAN (SDV) | 87.84% quality score |
| ADR (City) | `adr_model_city.pkl` | LightGBM | R² = 0.641 |
| ADR (Resort) | `adr_model_resort.pkl` | LightGBM | R² = 0.614 |
| Cancellation | `cancel_model.pkl` | LightGBM + Platt | AUC-ROC = 0.887 |
| No-Show | `noshow_model.onnx` | LightGBM | AUC-ROC = 0.822 |

## Game Modes

- **Classic Mode** — Guests arrive one-by-one with 30-second timers. Accept or reject each booking based on revenue, risk, and room availability.
- **Pricing Mode** — Set prices per room tier. The ML engine auto-books guests based on price sensitivity and simulates the week.

## Tech Stack

| Layer | Technology |
|---|---|
| ML Training | Python, LightGBM, SDV CTGAN, statsmodels |
| Inference Service | Python FastAPI + uvicorn |
| Backend | Node.js, Express 5, Socket.io 4.8 |
| Database | MySQL 8.0 (Sequelize ORM), Redis (ioredis) |
| Frontend | React 19, Vite 8, Zustand, Nivo Charts |
| Auth | JWT (jsonwebtoken + bcryptjs) |
