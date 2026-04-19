const redis = require('../config/redis');
const redisKeys = require('../config/redisKeys');
const gameService = require('../services/gameService');
const roomInventoryService = require('../services/roomInventoryService');
const leaderboardService = require('../services/leaderboardService');
const pricingService = require('../services/pricingService');
const weekResolutionService = require('../services/weekResolutionService');
const sessionRepository = require('../repositories/sessionRepository');
const weekRepository = require('../repositories/weekRepository');
const playerStateRepository = require('../repositories/playerStateRepository');
const weeklyScoreRepository = require('../repositories/weeklyScoreRepository');
const bookingRepository = require('../repositories/bookingRepository');
const { generateWeekGuests } = require('../demand/guestFactory');
const { getVolumeParams } = require('../demand/modelLoader');
const guestTimerManager = require('./guestTimerManager');

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
  await roomInventoryService.resetAllPlayerRooms(sessionId, playerIds, session.hotel_type, session.game_mode || 'pricing');

  // Emit game started
  io.to(`session:${sessionId}`).emit('game:started', {
    session_id: sessionId,
    hotel_type: session.hotel_type,
    total_weeks: session.total_weeks,
    game_mode: session.game_mode || 'pricing',
  });

  // Start the first week
  await _startWeek(io, session, 1);
}

async function _startWeek(io, session, weekNumber) {
  // Compute simulated month — 4 weeks per month
  const monthOffset = Math.floor((weekNumber - 1) / 4);
  const month = ((session.simulated_month - 1 + monthOffset) % 12) + 1;
  const monthName = MONTH_NAMES[month - 1];

  // Generate guests via demand layer
  let guests = await generateWeekGuests(session.hotel_type, month);

  // ─── Filter by segment config ──────────────────────────────────────────
  // Map frontend toggle keys → actual market_segment values
  const SEGMENT_GROUP_MAP = {
    corporate: ['Corporate'],
    leisure: ['Groups', 'Offline TA/TO'],
    transient: ['Online TA', 'Direct'],
    premium: ['Aviation', 'Complementary'],
  };

  try {
    const segJson = await redis.get(`session:${session.id}:segments`);
    if (segJson) {
      const segments = JSON.parse(segJson);
      const disabledSegments = [];
      for (const [key, enabled] of Object.entries(segments)) {
        if (enabled === false && SEGMENT_GROUP_MAP[key]) {
          disabledSegments.push(...SEGMENT_GROUP_MAP[key]);
        }
      }
      if (disabledSegments.length > 0) {
        const before = guests.length;
        guests = guests.filter(g => !disabledSegments.includes(g.market_segment));
        console.log(`[weekOrchestrator] Segment filter: ${before} → ${guests.length} guests (disabled: ${disabledSegments.join(', ')})`);
      }
    }
  } catch (err) {
    console.warn('[weekOrchestrator] Segment filter error (proceeding with all guests):', err.message);
  }

  // Determine game mode and demand level early (needed for classic trimming)
  const gameMode = session.game_mode || 'pricing';
  const demandLevel = _computeDemandLevel(session.hotel_type, month);

  // ─── Classic mode: trim guest count proportional to actual generated volume ─
  if (gameMode === 'classic') {
    const originalCount = guests.length;
    // Take ~12% of generated guests (±2% jitter), clamped to playable range
    const ratio = 0.10 + Math.random() * 0.04; // 10-14%
    const targetCount = Math.max(8, Math.min(35, Math.round(originalCount * ratio)));

    if (guests.length > targetCount) {
      // Stratified sampling: preserve segment diversity
      const bySegment = {};
      for (const g of guests) {
        const seg = g.market_segment || 'Other';
        if (!bySegment[seg]) bySegment[seg] = [];
        bySegment[seg].push(g);
      }

      // Proportional allocation per segment
      const sampled = [];
      const segments = Object.keys(bySegment);
      for (const seg of segments) {
        const pool = bySegment[seg];
        const allocation = Math.max(1, Math.round((pool.length / originalCount) * targetCount));
        const shuffled = pool.sort(() => Math.random() - 0.5);
        sampled.push(...shuffled.slice(0, allocation));
      }

      // Trim to exact target
      guests = sampled.slice(0, targetCount);

      // Re-index
      guests.forEach((g, i) => { g.index = i; });
      console.log(`[weekOrchestrator] Classic mode: ${originalCount} generated → ${guests.length} trimmed (${(ratio * 100).toFixed(0)}% ratio, demand: ${demandLevel})`);
    }
  }

  // Insert week record
  const week = await weekRepository.insert({
    session_id: session.id,
    week_number: weekNumber,
    simulated_month: month,
    guests_json: guests,
    guest_count: guests.length,
  });

  // Set session state in Redis
  await redis.set(
    redisKeys.sessionState(session.id),
    JSON.stringify({
      status: gameMode === 'pricing' ? 'awaiting_prices' : 'active',
      currentWeek: weekNumber,
      weekId: week.id,
      gameMode,
    }),
    'EX', 7200
  );

  // Reset room inventory for the new week
  const players = await sessionRepository.getPlayers(session.id);
  const playerIds = players.map((p) => p.user_id);
  await roomInventoryService.resetAllPlayerRooms(session.id, playerIds, session.hotel_type, gameMode);

  // Refresh TTLs
  await _refreshSessionTTLs(session.id, playerIds, weekNumber);

  // Get initial calendar for display
  const calendar = await roomInventoryService.getCalendar(session.id, playerIds[0]);

  if (gameMode === 'pricing') {
    // ─── PRICING MODE ───────────────────────────────────────────────────
    const suggestedPrices = _computeSuggestedPrices(guests);

    io.to(`session:${session.id}`).emit('week:started', {
      week_number: weekNumber,
      month_name: monthName,
      guest_count: guests.length,
      hotel_type: session.hotel_type,
      demand_level: demandLevel,
      calendar,
      suggested_prices: suggestedPrices,
      game_mode: 'pricing',
    });

    console.log(`[WeekOrchestrator] Week ${weekNumber} started — PRICING mode, awaiting prices (${guests.length} guests generated, demand: ${demandLevel})`);
  } else {
    // ─── CLASSIC MODE ───────────────────────────────────────────────────
    io.to(`session:${session.id}`).emit('week:started', {
      week_number: weekNumber,
      month_name: monthName,
      guest_count: guests.length,
      hotel_type: session.hotel_type,
      demand_level: demandLevel,
      calendar,
      game_mode: 'classic',
    });

    console.log(`[WeekOrchestrator] Week ${weekNumber} started — CLASSIC mode (${guests.length} guests, demand: ${demandLevel})`);

    // After a short delay, start releasing guests one by one
    setTimeout(() => {
      guestTimerManager.releaseNextGuest(
        io, session.id, week.id, guests, 0,
        beginResolution
      );
    }, 2000);
  }
}

/**
 * Called when player submits prices via socket. Runs the simulation.
 * Only applicable in PRICING mode.
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

/**
 * Called after all guests have been processed in CLASSIC mode.
 * Resolves bookings (cancellations, no-shows) and emits week:results.
 */
async function beginResolution(io, sessionId, weekId) {
  console.log(`[WeekOrchestrator] Begin resolution for week ${weekId} (classic mode)`);

  const stateRaw = await redis.get(redisKeys.sessionState(sessionId));
  const state = stateRaw ? JSON.parse(stateRaw) : {};
  const weekNum = state.currentWeek || 1;

  // Get all accepted bookings for this week
  const acceptedBookings = await bookingRepository.findAccepted(weekId);

  // Load guests
  const week = await weekRepository.findById(weekId);
  const guests_json = typeof week.guests_json === 'string'
    ? JSON.parse(week.guests_json) : week.guests_json;

  // Get session for hotel type
  const session = await sessionRepository.findById(sessionId);
  const hotelType = session.hotel_type || 'city';

  // Resolve outcomes (cancellations, no-shows, checkouts)
  const resolvedOutcomes = weekResolutionService.resolveBookings(acceptedBookings, guests_json);
  const playerStats = weekResolutionService.aggregateByPlayer(resolvedOutcomes, hotelType);

  // Update each booking with its outcome
  for (const r of resolvedOutcomes) {
    await bookingRepository.updateOutcome(r.bookingId, {
      outcome: r.outcome,
      revenue_realized: r.revenue_realized,
      resolved_at: new Date(),
    });
  }

  // Update player state and emit results per player
  const players = await sessionRepository.getPlayers(sessionId);
  const allBookings = await bookingRepository.getWeekBreakdown(weekId, players[0]?.user_id);
  const totalGuests = guests_json.length;
  const results = {};

  for (const player of players) {
    const userId = player.user_id;
    const stats = playerStats[userId] || {
      week_revenue: 0, cancellations: 0, no_shows: 0, guests_accepted: 0, occupancy_rate: 0,
    };

    // Count rejections and timeouts for this player
    const playerBookings = await bookingRepository.getWeekBreakdown(weekId, userId);
    const accepted = playerBookings.filter(b => b.decision === 'accepted').length;
    const rejected = playerBookings.filter(b => b.decision === 'rejected').length;
    const timedOut = playerBookings.filter(b => b.decision === 'timeout').length;
    const checkedOut = resolvedOutcomes.filter(r => r.userId === userId && r.outcome === 'checked_out').length;

    // Round revenue
    const weekRevenue = parseFloat(stats.week_revenue.toFixed(2));

    // Update player state
    await playerStateRepository.incrementRevenue(sessionId, userId, weekRevenue);
    const playerState = await playerStateRepository.findOne(sessionId, userId);

    // Insert weekly score
    await weeklyScoreRepository.insert({
      session_id: sessionId,
      week_id: weekId,
      user_id: userId,
      week_revenue: weekRevenue,
      cumulative_revenue: parseFloat(playerState.total_revenue),
      guests_accepted: accepted,
      guests_rejected: rejected + timedOut,
      cancellations: stats.cancellations,
      no_shows: stats.no_shows,
      occupancy_rate: stats.occupancy_rate,
    });

    results[userId] = {
      user_id: userId,
      name: player.name || 'Player',
      week_revenue: weekRevenue,
      cumulative_revenue: parseFloat(playerState.total_revenue),
      guests_booked: accepted,
      guests_turned_away: rejected + timedOut,
      guests_checked_out: checkedOut,
      cancellations: stats.cancellations,
      no_shows: stats.no_shows,
      occupancy_rate: stats.occupancy_rate,
      total_guests: totalGuests,
    };
  }

  // Update week status
  await weekRepository.updateStatus(weekId, 'completed', { ended_at: new Date() });

  // Build leaderboard
  const leaderboard = await leaderboardService.getSessionLeaderboard(sessionId);

  // Emit results
  io.to(`session:${sessionId}`).emit('week:results', {
    week_number: weekNum,
    results,
    leaderboard,
    game_mode: 'classic',
  });

  console.log(`[WeekOrchestrator] Classic mode week ${weekNum} resolved`);
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
    const min = Math.max(1, Math.round(adrs[0]));
    const max = Math.round(adrs[adrs.length - 1]);
    const median = Math.round(adrs[Math.floor(adrs.length / 2)]);
    suggested[tierName] = { min, max, median, count: adrs.length };
  }

  return suggested;
}

module.exports = { startGame, advanceWeek, submitPricesAndSimulate, beginResolution, _computeSuggestedPrices };
