const redis = require('../config/redis');
const redisKeys = require('../config/redisKeys');
const gameService = require('../services/gameService');
const roomInventoryService = require('../services/roomInventoryService');
const leaderboardService = require('../services/leaderboardService');
const pricingService = require('../services/pricingService');
const sessionRepository = require('../repositories/sessionRepository');
const weekRepository = require('../repositories/weekRepository');
const playerStateRepository = require('../repositories/playerStateRepository');
const weeklyScoreRepository = require('../repositories/weeklyScoreRepository');
const bookingRepository = require('../repositories/bookingRepository');
const { generateWeekGuests } = require('../demand/guestFactory');
const { getVolumeParams } = require('../demand/modelLoader');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

async function startGame(io, sessionId, requestingUserId) {
  const session = await gameService.validateAndStartGame(sessionId, requestingUserId);

  // Cache player count in Redis
  const players = await sessionRepository.getPlayers(sessionId);
  await redis.set(redisKeys.playerCount(sessionId), players.length, 'EX', 7200);

  // Reset room inventory for all players
  const playerIds = players.map((p) => p.user_id);
  await roomInventoryService.resetAllPlayerRooms(sessionId, playerIds, session.hotel_type);

  // Emit game started
  io.to(`session:${sessionId}`).emit('game:started', {
    session_id: sessionId,
    hotel_type: session.hotel_type,
    total_weeks: session.total_weeks,
  });

  // Start the first week
  await _startWeek(io, session, 1);
}

async function _startWeek(io, session, weekNumber) {
  // Compute simulated month
  const month = ((session.simulated_month + weekNumber - 2) % 12) + 1;
  const monthName = MONTH_NAMES[month - 1];

  // Generate guests via demand layer
  const guests = await generateWeekGuests(session.hotel_type, month);

  // Insert week record
  const week = await weekRepository.insert({
    session_id: session.id,
    week_number: weekNumber,
    simulated_month: month,
    guests_json: guests,
    guest_count: guests.length,
  });

  // Set session state in Redis — AWAITING PRICES (not active)
  await redis.set(
    redisKeys.sessionState(session.id),
    JSON.stringify({
      status: 'awaiting_prices',
      currentWeek: weekNumber,
      weekId: week.id,
    }),
    'EX', 7200
  );

  // Reset room inventory for the new week
  const players = await sessionRepository.getPlayers(session.id);
  const playerIds = players.map((p) => p.user_id);
  await roomInventoryService.resetAllPlayerRooms(session.id, playerIds, session.hotel_type);

  // Refresh TTLs
  await _refreshSessionTTLs(session.id, playerIds, weekNumber);

  // Compute demand level signal
  const demandLevel = _computeDemandLevel(session.hotel_type, month);

  // Get initial calendar for display
  const calendar = await roomInventoryService.getCalendar(session.id, playerIds[0]);

  // Compute suggested price ranges based on guest ADR distribution
  const suggestedPrices = _computeSuggestedPrices(guests);

  // Emit week started — frontend shows pricing interface
  io.to(`session:${session.id}`).emit('week:started', {
    week_number: weekNumber,
    month_name: monthName,
    guest_count: guests.length,
    hotel_type: session.hotel_type,
    demand_level: demandLevel,
    calendar,
    suggested_prices: suggestedPrices,
  });

  console.log(`[WeekOrchestrator] Week ${weekNumber} started — awaiting prices (${guests.length} guests generated, demand: ${demandLevel})`);
}

/**
 * Called when player submits prices via socket. Runs the simulation.
 */
async function submitPricesAndSimulate(io, sessionId, userId, prices) {
  // 1. Validate session state
  const stateRaw = await redis.get(redisKeys.sessionState(sessionId));
  if (!stateRaw) throw new Error('No active game state');
  const state = JSON.parse(stateRaw);

  if (state.status !== 'awaiting_prices') {
    throw new Error(`Cannot submit prices — current status: ${state.status}`);
  }

  // 2. Mark as simulating
  await redis.set(
    redisKeys.sessionState(sessionId),
    JSON.stringify({ ...state, status: 'simulating' }),
    'EX', 7200
  );

  io.to(`session:${sessionId}`).emit('week:simulating', {
    message: 'Running demand simulation...',
  });

  // 3. Run pricing simulation
  console.log(`[WeekOrchestrator] Simulating week ${state.currentWeek} with prices:`, prices);
  const simResults = await pricingService.simulateWeek({
    sessionId,
    weekId: state.weekId,
    userId,
    prices,
  });

  // 4. Update player state
  await playerStateRepository.incrementRevenue(sessionId, userId, simResults.week_revenue);
  const playerState = await playerStateRepository.findOne(sessionId, userId);

  // 5. Insert weekly score
  await weeklyScoreRepository.insert({
    session_id: sessionId,
    week_id: state.weekId,
    user_id: userId,
    week_revenue: simResults.week_revenue,
    cumulative_revenue: parseFloat(playerState.total_revenue),
    guests_accepted: simResults.guests_booked,
    guests_rejected: simResults.guests_turned_away,
    cancellations: simResults.cancellations,
    no_shows: simResults.no_shows,
    occupancy_rate: simResults.occupancy_rate,
  });

  // 6. Update week status
  await weekRepository.updateStatus(state.weekId, 'completed', { ended_at: new Date() });

  // 7. Build leaderboard
  const leaderboard = await leaderboardService.getSessionLeaderboard(sessionId);
  const session = await sessionRepository.findById(sessionId);

  // 8. Emit results
  io.to(`session:${sessionId}`).emit('week:results', {
    week_number: state.currentWeek,
    results: {
      [userId]: {
        user_id: userId,
        name: (await sessionRepository.getPlayers(sessionId))[0]?.name || 'Player',
        week_revenue: simResults.week_revenue,
        cumulative_revenue: parseFloat(playerState.total_revenue),
        guests_booked: simResults.guests_booked,
        guests_turned_away: simResults.guests_turned_away,
        guests_checked_out: simResults.guests_checked_out,
        cancellations: simResults.cancellations,
        no_shows: simResults.no_shows,
        occupancy_rate: simResults.occupancy_rate,
        adr: simResults.adr,
        revpar: simResults.revpar,
        tier_stats: simResults.tier_stats,
        prices_submitted: simResults.prices_submitted,
      },
    },
    leaderboard,
  });

  console.log(`[WeekOrchestrator] Week ${state.currentWeek} results — Revenue: $${simResults.week_revenue}, Booked: ${simResults.guests_booked}, Turned away: ${simResults.guests_turned_away}`);
}

async function advanceWeek(io, sessionId, requestingUserId) {
  const result = await gameService.validateAndAdvanceWeek(sessionId, requestingUserId);

  if (result.isLast) {
    await _endGame(io, sessionId);
  } else {
    const session = await sessionRepository.findById(sessionId);
    await _startWeek(io, session, result.nextWeek);
  }
}

async function _endGame(io, sessionId) {
  await gameService.endGame(sessionId);
  const leaderboard = await leaderboardService.getSessionLeaderboard(sessionId);
  io.to(`session:${sessionId}`).emit('game:completed', {
    final_leaderboard: leaderboard,
  });
}

// ─── Private helpers ────────────────────────────────────────────────────

async function _refreshSessionTTLs(sessionId, playerIds, weekNumber) {
  const TTL = 7200;
  const promises = [
    redis.expire(redisKeys.sessionState(sessionId), TTL),
    redis.expire(redisKeys.playerCount(sessionId), TTL),
  ];
  for (const userId of playerIds) {
    promises.push(redis.expire(redisKeys.playerRooms(sessionId, userId), TTL));
  }
  await Promise.all(promises);
}

const HOTEL_KEY = { city: 'City Hotel', resort: 'Resort Hotel' };

function _computeDemandLevel(hotelType, monthNum) {
  const volumeParams = getVolumeParams();
  const hotelKey = HOTEL_KEY[hotelType];
  const hotelParams = volumeParams[hotelKey];
  const monthName = MONTH_NAMES[monthNum - 1];

  const currentMu = hotelParams[monthName].mu;

  const allMus = Object.values(hotelParams).map((p) => p.mu);
  const muMin = Math.min(...allMus);
  const muMax = Math.max(...allMus);

  const normalized = (currentMu - muMin) / (muMax - muMin);
  if (normalized < 0.33) return 'Low';
  if (normalized < 0.66) return 'Medium';
  return 'High';
}

/**
 * Compute suggested price ranges based on guest ADR distribution per tier.
 */
function _computeSuggestedPrices(guests) {
  const TIER_MAP = { 1: 'standard', 2: 'mid', 3: 'premium', 4: 'suite' };
  const tiers = { standard: [], mid: [], premium: [], suite: [] };

  for (const g of guests) {
    const tierName = TIER_MAP[g.room_tier] || 'standard';
    tiers[tierName].push(g.adr_predicted || 0);
  }

  const suggested = {};
  for (const [tierName, adrs] of Object.entries(tiers)) {
    if (adrs.length === 0) {
      suggested[tierName] = { min: 50, max: 200, median: 100, count: 0 };
      continue;
    }
    adrs.sort((a, b) => a - b);
    const min = Math.round(adrs[0]);
    const max = Math.round(adrs[adrs.length - 1]);
    const median = Math.round(adrs[Math.floor(adrs.length / 2)]);
    suggested[tierName] = { min, max, median, count: adrs.length };
  }

  return suggested;
}

module.exports = { startGame, advanceWeek, submitPricesAndSimulate };
