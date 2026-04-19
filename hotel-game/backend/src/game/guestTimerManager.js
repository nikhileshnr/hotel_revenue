const redis = require('../config/redis');
const redisKeys = require('../config/redisKeys');
const bookingRepository = require('../repositories/bookingRepository');
const sessionRepository = require('../repositories/sessionRepository');
const weekRepository = require('../repositories/weekRepository');

// Module-level storage for timer handles keyed by sessionId
const timers = new Map();

// Generation counter to prevent stale callbacks from firing
// Each new guest release increments the generation; stale callbacks check before acting
const generations = new Map();

function releaseNextGuest(io, sessionId, weekId, guests, guestIndex, onComplete) {
  // Increment generation — any pending callbacks from previous guest become stale
  const gen = (generations.get(sessionId) || 0) + 1;
  generations.set(sessionId, gen);

  // Cancel any existing timer first
  cancelTimer(sessionId);

  // If guests is null, load from DB
  if (!guests) {
    weekRepository.findById(weekId).then((week) => {
      if (!week) return;
      const parsedGuests = typeof week.guests_json === 'string'
        ? JSON.parse(week.guests_json)
        : week.guests_json;
      _releaseGuest(io, sessionId, weekId, parsedGuests, guestIndex, onComplete, gen);
    });
  } else {
    _releaseGuest(io, sessionId, weekId, guests, guestIndex, onComplete, gen);
  }
}

async function _releaseGuest(io, sessionId, weekId, guests, guestIndex, onComplete, gen) {
  // Check if this release is still current (not superseded)
  if (generations.get(sessionId) !== gen) {
    console.log(`[guestTimerManager] Stale release ignored (gen ${gen} vs current ${generations.get(sessionId)})`);
    return;
  }

  // If all guests processed, begin resolution
  if (guestIndex >= guests.length) {
    console.log(`[guestTimerManager] All ${guests.length} guests processed — beginning resolution`);
    onComplete(io, sessionId, weekId);
    return;
  }

  // Update session state with current guest index
  const stateRaw = await redis.get(redisKeys.sessionState(sessionId));
  const state = stateRaw ? JSON.parse(stateRaw) : {};
  const weekNum = state.currentWeek || 1;

  // Clear previous decisions for this guest
  const decKey = redisKeys.decisions(sessionId, weekNum, guestIndex);
  await redis.del(decKey);

  state.currentGuestIndex = guestIndex;
  await redis.set(
    redisKeys.sessionState(sessionId),
    JSON.stringify(state),
    'EX', 7200
  );

  // Store current guest index for fast lookups
  await redis.set(
    redisKeys.currentGuest(sessionId, weekNum),
    String(guestIndex),
    'EX', 7200
  );

  const guest = guests[guestIndex];
  const TIMER_MS = 30000;

  // Store timer expiry timestamp
  await redis.set(
    redisKeys.guestTimer(sessionId, weekNum),
    String(Date.now() + TIMER_MS),
    'EX', 7200
  );

  // Emit guest arrival
  io.to(`session:${sessionId}`).emit('guest:arrived', {
    guest,
    guest_index: guestIndex,
    total_guests: guests.length,
    timer_ms: TIMER_MS,
  });

  console.log(`[guestTimerManager] Released guest ${guestIndex + 1}/${guests.length} (gen ${gen})`);

  // Start countdown
  let remainingMs = TIMER_MS;
  const interval = setInterval(() => {
    // Check generation — if stale, stop ticking
    if (generations.get(sessionId) !== gen) {
      clearInterval(interval);
      return;
    }
    remainingMs -= 1000;
    io.to(`session:${sessionId}`).emit('guest:countdown', {
      remaining_ms: Math.max(0, remainingMs),
    });
  }, 1000);

  // Start timeout
  const timeout = setTimeout(() => {
    // Check generation — only fire if still current
    if (generations.get(sessionId) !== gen) {
      console.log(`[guestTimerManager] Stale timeout ignored for guest ${guestIndex} (gen ${gen})`);
      return;
    }
    _handleExpiry(io, sessionId, weekId, guestIndex, weekNum, guests, onComplete, gen);
  }, TIMER_MS);

  // Store handles
  timers.set(sessionId, { interval, timeout });
}

async function _handleExpiry(io, sessionId, weekId, guestIndex, weekNum, guests, onComplete, gen) {
  // Double-check generation hasn't changed (decision arrived just before timeout)
  if (generations.get(sessionId) !== gen) {
    console.log(`[guestTimerManager] Expiry aborted — decision already advanced guest (gen ${gen})`);
    return;
  }

  cancelTimer(sessionId);

  const decKey = redisKeys.decisions(sessionId, weekNum, guestIndex);
  const decidedIds = await redis.smembers(decKey);
  const decidedSet = new Set(decidedIds);

  // Any player who didn't decide gets a timeout booking
  const players = await sessionRepository.getPlayers(sessionId);
  const timedOutIds = [];

  for (const player of players) {
    if (!decidedSet.has(player.user_id)) {
      await bookingRepository.insert({
        session_id: sessionId,
        week_id: weekId,
        user_id: player.user_id,
        guest_index: guestIndex,
        decision: 'timeout',
      });
      timedOutIds.push(player.user_id);
    }
  }

  // Emit expired
  io.to(`session:${sessionId}`).emit('guest:expired', {
    guest_index: guestIndex,
    decided: decidedIds,
    timed_out: timedOutIds,
  });

  console.log(`[guestTimerManager] Guest ${guestIndex} expired — ${timedOutIds.length} timed out`);

  // After delay, release next guest (generation check happens in releaseNextGuest)
  setTimeout(() => {
    releaseNextGuest(io, sessionId, weekId, guests, guestIndex + 1, onComplete);
  }, 2000);
}

function cancelTimer(sessionId) {
  const handles = timers.get(sessionId);
  if (handles) {
    clearInterval(handles.interval);
    clearTimeout(handles.timeout);
    timers.delete(sessionId);
  }
}

module.exports = { releaseNextGuest, cancelTimer };
