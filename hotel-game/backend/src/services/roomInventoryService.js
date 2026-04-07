const redis = require('../config/redis');
const redisKeys = require('../config/redisKeys');

const HOTEL_INVENTORY = {
  city: { standard: 15, mid: 10, premium: 8, suite: 4 },
  resort: { standard: 12, mid: 8, premium: 6, suite: 4 },
};

const TIER_TO_NAME = { 1: 'standard', 2: 'mid', 3: 'premium', 4: 'suite' };

// --- Week Calendar helpers (Gap 5: LOS-aware inventory) ---

/**
 * Build a fresh 7-day calendar for a hotel type.
 * Each tier has an array of 7 values — each value = number of rooms available that day.
 */
function _buildFreshCalendar(hotelType) {
  const inv = HOTEL_INVENTORY[hotelType];
  const calendar = {};
  for (const [tierName, capacity] of Object.entries(inv)) {
    calendar[tierName] = Array(7).fill(capacity);
  }
  return calendar;
}

/**
 * Check if a guest with given arrival_day and LOS can fit in a tier.
 * Days are 1-indexed (1–7). LOS may overflow past day 7; we only block within the week.
 */
function _canFit(calendar, tierName, arrivalDay, los) {
  const arr = calendar[tierName];
  if (!arr) return false;
  const startIdx = arrivalDay - 1; // convert to 0-indexed
  const endIdx = Math.min(startIdx + los, 7); // clamp within 7-day week
  for (let d = startIdx; d < endIdx; d++) {
    if (arr[d] <= 0) return false;
  }
  return true;
}

/**
 * Mark days as occupied in the calendar. Returns updated calendar.
 */
function _markOccupied(calendar, tierName, arrivalDay, los, guestIndex) {
  const startIdx = arrivalDay - 1;
  const endIdx = Math.min(startIdx + los, 7);
  for (let d = startIdx; d < endIdx; d++) {
    calendar[tierName][d] -= 1;
  }
  return calendar;
}

// --- Redis operations ---

async function resetPlayerRooms(sessionId, userId, hotelType) {
  const rooms = { ...HOTEL_INVENTORY[hotelType] };
  const calendar = _buildFreshCalendar(hotelType);
  const key = redisKeys.playerRooms(sessionId, userId);
  await redis.set(key, JSON.stringify({ rooms, calendar }), 'EX', 7200);
}

async function resetAllPlayerRooms(sessionId, playerIds, hotelType) {
  await Promise.all(
    playerIds.map((userId) => resetPlayerRooms(sessionId, userId, hotelType))
  );
}

async function getRooms(sessionId, userId) {
  const key = redisKeys.playerRooms(sessionId, userId);
  const raw = await redis.get(key);
  if (!raw) return null;
  const data = JSON.parse(raw);
  // Backward compat: if data has no 'rooms' key, it IS the rooms object
  if (data.rooms) return data.rooms;
  return data;
}

async function getCalendar(sessionId, userId) {
  const key = redisKeys.playerRooms(sessionId, userId);
  const raw = await redis.get(key);
  if (!raw) return null;
  const data = JSON.parse(raw);
  return data.calendar || null;
}

async function setCalendar(sessionId, userId, calendar) {
  const key = redisKeys.playerRooms(sessionId, userId);
  const raw = await redis.get(key);
  if (!raw) return;
  const data = JSON.parse(raw);
  data.calendar = calendar;
  // Also update simple room counts from calendar
  for (const [tierName, days] of Object.entries(calendar)) {
    if (data.rooms && data.rooms[tierName] !== undefined) {
      data.rooms[tierName] = Math.min(...days);
    }
  }
  await redis.set(key, JSON.stringify(data), 'EX', 7200);
}

/**
 * Check if a guest can be accepted for a given tier, arrival day, and LOS.
 */
async function canAcceptGuest(sessionId, userId, tier, arrivalDay, los) {
  const tierName = TIER_TO_NAME[tier] || TIER_TO_NAME[String(tier)];
  if (!tierName) return false;

  const key = redisKeys.playerRooms(sessionId, userId);
  const raw = await redis.get(key);
  if (!raw) return false;

  const data = JSON.parse(raw);
  const calendar = data.calendar;
  if (!calendar) return false;

  return _canFit(calendar, tierName, arrivalDay, los);
}

/**
 * Occupy room for LOS days. Uses WATCH/MULTI for atomic update.
 * Returns { rooms, calendar } on success, null on failure.
 */
async function occupyRoomForLOS(sessionId, userId, tier, arrivalDay, los, guestIndex) {
  const tierName = TIER_TO_NAME[tier] || TIER_TO_NAME[String(tier)];
  if (!tierName) return null;

  const key = redisKeys.playerRooms(sessionId, userId);

  // Retry once on abort
  for (let attempt = 0; attempt < 2; attempt++) {
    await redis.watch(key);
    const raw = await redis.get(key);
    if (!raw) {
      await redis.unwatch();
      return null;
    }

    const data = JSON.parse(raw);
    const calendar = data.calendar;
    const rooms = data.rooms;

    // Check availability across all days of stay
    if (!_canFit(calendar, tierName, arrivalDay, los)) {
      await redis.unwatch();
      return null;
    }

    // Mark days as occupied
    _markOccupied(calendar, tierName, arrivalDay, los, guestIndex);

    // Also decrement the simple room count
    if (rooms[tierName] !== undefined) {
      rooms[tierName] = Math.max(0, rooms[tierName] - 1);
    }

    const multi = redis.multi();
    multi.set(key, JSON.stringify({ rooms, calendar }), 'EX', 7200);
    const results = await multi.exec();

    if (results) {
      return { rooms, calendar }; // Transaction succeeded
    }
    // Transaction aborted (WATCH triggered), retry
  }

  return null; // Both attempts failed
}

/**
 * Legacy occupyRoom for backward compatibility (no LOS awareness).
 * Decrements simple room count only.
 */
async function occupyRoom(sessionId, userId, tier) {
  const tierName = TIER_TO_NAME[tier] || TIER_TO_NAME[String(tier)];
  if (!tierName) return null;

  const key = redisKeys.playerRooms(sessionId, userId);

  for (let attempt = 0; attempt < 2; attempt++) {
    await redis.watch(key);
    const raw = await redis.get(key);
    if (!raw) {
      await redis.unwatch();
      return null;
    }

    const data = JSON.parse(raw);
    const rooms = data.rooms || data;
    if (!rooms[tierName] || rooms[tierName] <= 0) {
      await redis.unwatch();
      return null;
    }

    rooms[tierName] -= 1;
    if (data.rooms) data.rooms = rooms;

    const multi = redis.multi();
    multi.set(key, JSON.stringify(data.rooms ? data : rooms), 'EX', 7200);
    const results = await multi.exec();

    if (results) {
      return rooms;
    }
  }

  return null;
}

module.exports = {
  HOTEL_INVENTORY,
  TIER_TO_NAME,
  resetPlayerRooms,
  resetAllPlayerRooms,
  getRooms,
  getCalendar,
  setCalendar,
  canAcceptGuest,
  occupyRoom,
  occupyRoomForLOS,
};
