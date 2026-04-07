# Concerns

## Critical Issues

### 1. Frontend Not Implemented

- **File:** `hotel-game/frontend/src/App.jsx`
- **Issue:** Still default Vite scaffold — no game UI, no Socket.io integration, no routing
- **Impact:** Backend is fully built but unusable without frontend
- **Severity:** 🔴 Critical — blocks all user testing

### 2. No Automated Test Suite

- **Files:** Entire `hotel-game/backend/` and `profile-service/`
- **Issue:** No unit or integration test framework configured; only one manual test script
- **Impact:** Bugs caught only through manual testing; regression risk on any change
- **Severity:** 🟡 Medium

## Technical Debt

### 3. Circular Require in Decision Handler

- **File:** `hotel-game/backend/src/socket/handlers/decisionHandler.js` (line 54)
- **Issue:** `require('../../game/weekOrchestrator')` inside setTimeout callback to avoid circular dependency
- **Impact:** Fragile; change in module structure could break

### 4. Legacy `occupyRoom` Function

- **File:** `hotel-game/backend/src/services/roomInventoryService.js` (line 158)
- **Issue:** Legacy room occupation function (no LOS awareness) kept for backward compatibility alongside LOS-aware `occupyRoomForLOS`
- **Impact:** Dead code if no callers use it; potential confusion

### 5. No Input Validation on Socket Events

- **Files:** `hotel-game/backend/src/socket/handlers/*.js`
- **Issue:** Socket event payloads are not schema-validated (no joi/zod)
- **Impact:** Malformed client messages could cause server errors

### 6. Redis Key TTL Management

- **Files:** `hotel-game/backend/src/config/redisKeys.js`, `src/game/weekOrchestrator.js`
- **Issue:** All Redis keys use hardcoded 7200s TTL; `_refreshSessionTTLs` was added as a bug fix but is manually called
- **Impact:** Long games could hit TTL expiry; no centralized TTL policy

## Security Concerns

### 7. Secrets in .env Files

- **Files:** `hotel-game/backend/.env`, `profile-service/.env`
- **Issue:** `.env` files exist but no `.gitignore` verified (git not initialized yet)
- **Impact:** Risk of committing secrets if `.gitignore` not set up

### 8. No Rate Limiting

- **Files:** `hotel-game/backend/src/routes/*.js`
- **Issue:** No rate limiting on auth endpoints (register, login)
- **Impact:** Brute force vulnerability

### 9. JWT Secret Management

- **File:** `hotel-game/backend/src/middleware/auth.js`
- **Issue:** JWT_SECRET from environment only — no rotation mechanism, no token expiry configured
- **Impact:** Compromised tokens remain valid indefinitely

## Performance Considerations

### 10. Synchronous ONNX Inference

- **File:** `hotel-game/backend/src/demand/adrPredictor.js`, `riskPredictor.js`
- **Issue:** ONNX inference runs synchronously in the event loop for fallback path
- **Impact:** Could block other requests during guest generation when profile service is down

### 11. Profile Service Single-Threaded

- **File:** `profile-service/main.py`
- **Issue:** FastAPI runs with default uvicorn workers; CTGAN generation is CPU-intensive
- **Impact:** Multiple concurrent game sessions could bottleneck on guest generation

## Areas of Fragility

### 12. Guest JSON Parsing

- **File:** `hotel-game/backend/src/game/weekOrchestrator.js` (line 115)
- **Issue:** `guests_json` may be string or object depending on DB/ORM behavior — explicit check added
- **Impact:** Type inconsistency is a common source of bugs

### 13. No Database Seeding

- **Issue:** No seeder scripts for development data
- **Impact:** Every developer needs to manually create test data
