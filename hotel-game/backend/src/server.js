require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const sequelize = require('./config/db');
const redis = require('./config/redis');
const { initSocket } = require('./socket');
const { loadAllModels } = require('./demand/modelLoader');

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

// Global error handler
app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[Error] ${statusCode}: ${err.message}`);
  res.status(statusCode).json({ error: err.message });
});

// Start server
async function start() {
  try {
    // Verify DB connection
    await sequelize.authenticate();
    console.log('[DB] MySQL connected');

    // Verify Redis connection
    await redis.ping();
    console.log('[Redis] Ping successful');

    // Load ML models
    await loadAllModels();

    // Non-blocking health check for Python profile-service
    const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:8000';
    try {
      const healthRes = await fetch(`${PROFILE_SERVICE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      if (healthRes.ok) {
        const data = await healthRes.json();
        console.log(`[startup] Python service connected — CTGAN trained ${data.ctgan_trained_date}`);
      } else {
        console.warn(`[startup] Python service returned ${healthRes.status} — statistical fallback active`);
      }
    } catch (e) {
      console.warn('[startup] Python service not reachable — statistical fallback active');
    }

    // Create HTTP server and init Socket.io
    const server = http.createServer(app);
    initSocket(server);

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`[Server] Listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
