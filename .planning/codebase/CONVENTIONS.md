# Code Conventions

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
