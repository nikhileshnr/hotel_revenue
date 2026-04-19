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
        // Game already in progress — rejoin and re-emit current state
        console.log(`[gameHandler] Rejoined room for active session ${session_id}`);
        const state = JSON.parse(stateRaw);

        const weekRepository = require('../../repositories/weekRepository');
        const sessionRepository = require('../../repositories/sessionRepository');
        const roomInventoryService = require('../../services/roomInventoryService');
        const guestTimerManager = require('../../game/guestTimerManager');

        const session = await sessionRepository.findById(session_id);
        const weeks = await weekRepository.findAllBySession(session_id);
        const currentWeek = weeks.find(w => w.week_number === state.currentWeek);

        if (!currentWeek) {
          console.log(`[gameHandler] No week data found — starting fresh`);
          await weekOrchestrator.startGame(io, session_id, socket.user.id);
          return;
        }

        // Case 1: Week already completed — advance to next week
        if (currentWeek.status === 'completed') {
          console.log(`[gameHandler] Week ${state.currentWeek} already completed — advancing`);
          try {
            await weekOrchestrator.advanceWeek(io, session_id, socket.user.id);
          } catch (err) {
            // Game might be fully done
            console.log(`[gameHandler] Advance failed (game may be complete): ${err.message}`);
            socket.emit('game:completed', {});
          }
          return;
        }

        // Case 2 & 3: Week still in progress — re-emit state
        const guests = typeof currentWeek.guests_json === 'string'
          ? JSON.parse(currentWeek.guests_json) : currentWeek.guests_json;

        const MONTH_NAMES = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
        ];
        const monthName = MONTH_NAMES[(currentWeek.simulated_month || 1) - 1];
        const calendar = await roomInventoryService.getCalendar(session_id, socket.user.id);
        const gameMode = state.gameMode || session.game_mode || 'pricing';

        const playerStateRepository = require('../../repositories/playerStateRepository');

        // Get cumulative revenue from DB
        const playerState = await playerStateRepository.findOne(session_id, socket.user.id);
        const cumulativeRevenue = playerState ? parseFloat(playerState.total_revenue) : 0;

        // Re-emit week:started with cumulative revenue
        socket.emit('week:started', {
          week_number: state.currentWeek,
          month_name: monthName,
          guest_count: guests ? guests.length : 0,
          hotel_type: session.hotel_type,
          demand_level: state.demandLevel || 'Medium',
          calendar,
          game_mode: gameMode,
          suggested_prices: gameMode === 'pricing' ? require('../../game/weekOrchestrator')._computeSuggestedPrices(guests) : undefined,
          cumulative_revenue: cumulativeRevenue,
        });

        console.log(`[gameHandler] Re-emitted week:started for week ${state.currentWeek} (mode: ${gameMode})`);

        // Case 2: Classic mode — restart guest release from beginning
        if (gameMode === 'classic' && guests && guests.length > 0) {
          setTimeout(() => {
            guestTimerManager.releaseNextGuest(
              io, session_id, currentWeek.id, guests, 0,
              weekOrchestrator.beginResolution
            );
          }, 2000);
          console.log(`[gameHandler] Restarted classic guest timer for week ${state.currentWeek}`);
        }

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
