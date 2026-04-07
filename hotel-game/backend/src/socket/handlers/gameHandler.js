const weekOrchestrator = require('../../game/weekOrchestrator');
const redis = require('../../config/redis');
const redisKeys = require('../../config/redisKeys');

module.exports = function gameHandler(io, socket) {
  // game:start { session_id } — session owner starts/rejoins the game
  socket.on('game:start', async ({ session_id }) => {
    try {
      console.log(`[gameHandler] game:start from ${socket.user.name} for session ${session_id}`);

      // Always join the socket room
      socket.join(`session:${session_id}`);
      socket.sessionId = session_id;

      // Check if game is already running (reconnect case)
      const stateRaw = await redis.get(redisKeys.sessionState(session_id));
      if (stateRaw) {
        // Game already in progress — just rejoined the room, events will reach us
        console.log(`[gameHandler] Rejoined room for active session ${session_id}`);
        return;
      }

      // First time — start the game (generates guests, emits week:started, starts timer)
      await weekOrchestrator.startGame(io, session_id, socket.user.id);
      console.log(`[gameHandler] Game started for session ${session_id}`);
    } catch (err) {
      console.error(`[gameHandler] game:start ERROR:`, err.message);
      socket.emit('error', { message: err.message });
    }
  });

  // game:advance_week — after seeing week:results, frontend auto-advances
  socket.on('game:advance_week', async ({ session_id }) => {
    try {
      const sid = session_id || socket.sessionId;
      console.log(`[gameHandler] advance_week for session ${sid}`);
      await weekOrchestrator.advanceWeek(io, sid, socket.user.id);
    } catch (err) {
      console.error(`[gameHandler] advance_week ERROR:`, err.message);
      socket.emit('error', { message: err.message });
    }
  });

  // player:submit_prices — student submits room prices for the week
  socket.on('player:submit_prices', async (data) => {
    try {
      const { session_id, prices } = data;
      const sid = session_id || socket.sessionId;

      // Validate all 4 tier prices
      if (!prices || typeof prices.standard !== 'number' || typeof prices.mid !== 'number' ||
          typeof prices.premium !== 'number' || typeof prices.suite !== 'number') {
        socket.emit('pricing:error', { message: 'All 4 tier prices required (standard, mid, premium, suite)' });
        return;
      }

      // Validate positive numbers
      if (prices.standard <= 0 || prices.mid <= 0 || prices.premium <= 0 || prices.suite <= 0) {
        socket.emit('pricing:error', { message: 'All prices must be positive' });
        return;
      }

      console.log(`[gameHandler] Prices submitted for session ${sid}:`, prices);
      await weekOrchestrator.submitPricesAndSimulate(io, sid, socket.user.id, prices);
    } catch (err) {
      console.error(`[gameHandler] submit_prices ERROR:`, err.message);
      socket.emit('pricing:error', { message: err.message });
    }
  });
};
