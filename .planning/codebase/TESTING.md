# Testing

## Current State

### Backend

- **No automated test suite** — no test framework (Jest, Mocha, etc.) is configured
- **One integration test script:** `hotel-game/backend/test_socket.mjs` — manual Socket.io test client that:
  - Registers/logs in users
  - Creates a session
  - Joins lobby
  - Starts game
  - Makes automatic accept/reject decisions
  - Validates week results
- **Manual verification:** Documented in `BACKEND_VERIFICATION_RESULTS.md` and `backend_verification_plan.md`
- **No unit tests** for services, repositories, or game logic
- **No CI/CD pipeline** configured

### Frontend

- **No tests** — frontend is still scaffold
- **ESLint** configured for code linting only

### Demand Model

- **Pipeline self-validation:** `08_validate_pipeline.py` validates model outputs against historical data
- **CTGAN evaluation:** `10_evaluate_ctgan.py` evaluates synthetic data quality
- **Training report:** `TRAINING_REPORT.md` with comprehensive results

### Profile Service

- **No automated tests** — tested through backend integration only

## Test Coverage Gaps

| Area | Gap |
|------|-----|
| Unit tests | None exist for any component |
| Integration tests | Only manual `test_socket.mjs` |
| API tests | No REST endpoint tests |
| CI/CD | No automated pipeline |
| Load testing | No stress/performance tests |
| Frontend tests | No component or E2E tests |

## Recommended Actions

1. Add Jest + Supertest for backend API testing
2. Add React Testing Library for frontend components
3. Add pytest for profile-service endpoints
4. Create CI pipeline with migration + test runs
