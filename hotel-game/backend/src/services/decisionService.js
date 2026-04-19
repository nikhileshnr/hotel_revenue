const redis = require('../config/redis');
const redisKeys = require('../config/redisKeys');
const roomInventoryService = require('./roomInventoryService');
const bookingRepository = require('../repositories/bookingRepository');
const weekRepository = require('../repositories/weekRepository');
const AppError = require('../utils/AppError');

async function recordDecision({ sessionId, weekId, userId, guestIndex, decision, roomTier, weekNum }) {
  // 1. Load session state from Redis
  const stateRaw = await redis.get(redisKeys.sessionState(sessionId));
  if (!stateRaw) throw new AppError('No active game state', 400);
  const state = JSON.parse(stateRaw);

  // 2. Check stale decision
  if (guestIndex !== state.currentGuestIndex) {
    throw new AppError('Stale decision — guest has already moved on', 400);
  }

  // 3. Check duplicate decision
  const decKey = redisKeys.decisions(sessionId, weekNum, guestIndex);
  const alreadyDecided = await redis.sismember(decKey, userId);
  if (alreadyDecided) throw new AppError('Already decided for this guest', 409);

  // Load guest data for LOS-aware inventory and expected_value
  const week = await weekRepository.findById(weekId);
  const guests_json = typeof week.guests_json === 'string'
    ? JSON.parse(week.guests_json)
    : week.guests_json;
  const guest = guests_json[guestIndex];

  let roomsRemaining = null;
  let weekCalendar = null;

  if (decision === 'accepted') {
    // LOS-aware room occupation
    const result = await roomInventoryService.occupyRoomForLOS(
      sessionId, userId, roomTier,
      guest.arrival_day || 1, guest.los || 1, guestIndex
    );
    if (!result) throw new AppError('No rooms available in that tier for the required days', 400);
    roomsRemaining = result.rooms;
    weekCalendar = result.calendar;

    // Insert accepted booking with expected_value (Migration 010)
    await bookingRepository.insert({
      session_id: sessionId,
      week_id: weekId,
      user_id: userId,
      guest_index: guestIndex,
      decision: 'accepted',
      room_tier: String(roomTier),
      decided_at: new Date(),
      expected_value: guest.expected_value || 0,
    });
  } else {
    // 5. Insert rejected booking
    await bookingRepository.insert({
      session_id: sessionId,
      week_id: weekId,
      user_id: userId,
      guest_index: guestIndex,
      decision: 'rejected',
      decided_at: new Date(),
    });

    // Get current rooms for response
    roomsRemaining = await roomInventoryService.getRooms(sessionId, userId);
    weekCalendar = await roomInventoryService.getCalendar(sessionId, userId);
  }

  // 6. Mark as decided
  await redis.sadd(decKey, userId);
  await redis.expire(decKey, 7200);

  // Refresh sessionState TTL on every decision
  await redis.expire(redisKeys.sessionState(sessionId), 7200);

  // 7. Check if all decided
  const decidedCount = await redis.scard(decKey);
  const playerCountRaw = await redis.get(redisKeys.playerCount(sessionId));
  const playerCount = parseInt(playerCountRaw, 10) || 1;
  const allDecided = decidedCount >= playerCount;

  return { allDecided, roomsRemaining, weekCalendar };
}

module.exports = { recordDecision };
