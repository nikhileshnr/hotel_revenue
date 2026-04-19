const redis = require('../../config/redis');
const redisKeys = require('../../config/redisKeys');
const decisionService = require('../../services/decisionService');
const guestTimerManager = require('../../game/guestTimerManager');

module.exports = function decisionHandler(io, socket) {
  // player:decision { guest_index, decision, room_tier? }
  socket.on('player:decision', async ({ guest_index, decision, room_tier }) => {
    try {
      console.log(`[decisionHandler] player:decision from ${socket.user?.name}: guest=${guest_index}, decision=${decision}, room_tier=${room_tier}`);
      const sessionId = socket.sessionId;
      if (!sessionId) {
        console.error('[decisionHandler] No sessionId on socket');
        return socket.emit('decision:error', { message: 'Not in a session' });
      }

      // Get weekId from Redis session state
      const stateRaw = await redis.get(redisKeys.sessionState(sessionId));
      if (!stateRaw) {
        console.error('[decisionHandler] No session state in Redis');
        return socket.emit('decision:error', { message: 'No active game state' });
      }
      const state = JSON.parse(stateRaw);

      const result = await decisionService.recordDecision({
        sessionId,
        weekId: state.weekId,
        userId: socket.user.id,
        guestIndex: guest_index,
        decision,
        roomTier: room_tier,
        weekNum: state.currentWeek,
      });

      console.log(`[decisionHandler] Decision recorded: allDecided=${result.allDecided}`);

      // Emit confirmation to this player only
      socket.emit('decision:confirmed', {
        guest_index,
        decision,
        rooms_remaining: result.roomsRemaining,
        week_calendar: result.weekCalendar,
      });

      // If all players have decided, advance to next guest
      // releaseNextGuest handles generation increment and timer cancellation internally
      if (result.allDecided) {
        setTimeout(() => {
          const weekOrchestrator = require('../../game/weekOrchestrator');
          guestTimerManager.releaseNextGuest(
            io,
            sessionId,
            state.weekId,
            null, // guests loaded from week record
            guest_index + 1,
            weekOrchestrator.beginResolution
          );
        }, 1500);
      }
    } catch (err) {
      console.error(`[decisionHandler] ERROR:`, err.message);
      socket.emit('decision:error', { message: err.message });
    }
  });
};
