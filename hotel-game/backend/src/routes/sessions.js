const { Router } = require('express');
const authMiddleware = require('../middleware/auth');
const sessionService = require('../services/sessionService');
const leaderboardService = require('../services/leaderboardService');
const weekRepository = require('../repositories/weekRepository');
const bookingRepository = require('../repositories/bookingRepository');
const weeklyScoreRepository = require('../repositories/weeklyScoreRepository');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// 1. POST / — create session
router.post('/', async (req, res, next) => {
  try {
    const session = await sessionService.createSession({
      userId: req.user.id,
      hotel_type: req.body.hotel_type,
      total_weeks: req.body.total_weeks,
      segments: req.body.segments,
      game_mode: req.body.game_mode,
    });
    res.status(201).json(session);
  } catch (err) { next(err); }
});

// 2. GET /mine — get my sessions
router.get('/mine', async (req, res, next) => {
  try {
    const sessions = await sessionService.getMySessions(req.user.id);
    res.json(sessions);
  } catch (err) { next(err); }
});

// 3. GET /leaderboard — global leaderboard with optional branch filter
router.get('/leaderboard', async (req, res, next) => {
  try {
    const branch = req.query.branch || null;
    const leaderboard = await leaderboardService.getGlobalLeaderboard(branch);
    res.json(leaderboard);
  } catch (err) { next(err); }
});

// 4. GET /branches — get distinct branches for filter dropdown
router.get('/branches', async (req, res, next) => {
  try {
    const branches = await userRepository.getDistinctBranches();
    res.json(branches);
  } catch (err) { next(err); }
});

// 5. GET /:id — get single session details
router.get('/:id', async (req, res, next) => {
  try {
    const session = await require('../repositories/sessionRepository').findById(req.params.id);
    if (!session) throw new AppError('Session not found', 404);
    res.json(session);
  } catch (err) { next(err); }
});

// 6. GET /:id/leaderboard — session leaderboard
router.get('/:id/leaderboard', async (req, res, next) => {
  try {
    const leaderboard = await leaderboardService.getSessionLeaderboard(req.params.id);
    res.json(leaderboard);
  } catch (err) { next(err); }
});

// 6. GET /:id/history — player's week-by-week history
router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await weeklyScoreRepository.getHistory(req.params.id, req.user.id);
    res.json(history);
  } catch (err) { next(err); }
});

// 7. GET /:id/week/:weekNumber/breakdown — detailed booking breakdown
router.get('/:id/week/:weekNumber/breakdown', async (req, res, next) => {
  try {
    const week = await weekRepository.findByNumber(req.params.id, parseInt(req.params.weekNumber, 10));
    if (!week) throw new AppError('Week not found', 404);

    const bookings = await bookingRepository.getWeekBreakdown(week.id, req.user.id);
    const guests_json = typeof week.guests_json === 'string'
      ? JSON.parse(week.guests_json)
      : week.guests_json;

    const enriched = bookings.map((b) => ({
      ...b,
      guest: guests_json[b.guest_index] || null,
    }));

    res.json(enriched);
  } catch (err) { next(err); }
});

// 8. GET /:id/results — aggregated game results for the results page
router.get('/:id/results', async (req, res, next) => {
  try {
    const history = await weeklyScoreRepository.getHistory(req.params.id, req.user.id);
    if (!history || history.length === 0) {
      return res.json({ weeks: [], summary: null });
    }

    const totalRevenue = history.reduce((s, w) => s + parseFloat(w.week_revenue || 0), 0);
    const avgOccupancy = history.reduce((s, w) => s + parseFloat(w.occupancy_rate || 0), 0) / history.length;
    const bestWeek = history.reduce((best, w) => parseFloat(w.week_revenue) > parseFloat(best.week_revenue) ? w : best, history[0]);
    const totalBooked = history.reduce((s, w) => s + parseInt(w.guests_accepted || 0, 10), 0);
    const totalRejected = history.reduce((s, w) => s + parseInt(w.guests_rejected || 0, 10), 0);
    const totalCancellations = history.reduce((s, w) => s + parseInt(w.cancellations || 0, 10), 0);
    const totalNoShows = history.reduce((s, w) => s + parseInt(w.no_shows || 0, 10), 0);

    res.json({
      weeks: history.map(w => ({
        week_number: w.week_number,
        week_revenue: parseFloat(w.week_revenue),
        cumulative_revenue: parseFloat(w.cumulative_revenue),
        occupancy_rate: parseFloat(w.occupancy_rate),
        guests_booked: parseInt(w.guests_accepted || 0, 10),
        guests_turned_away: parseInt(w.guests_rejected || 0, 10),
        cancellations: parseInt(w.cancellations || 0, 10),
        no_shows: parseInt(w.no_shows || 0, 10),
      })),
      summary: {
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        avg_occupancy: parseFloat((avgOccupancy * 100).toFixed(1)),
        best_week: parseInt(bestWeek.week_number, 10),
        best_week_revenue: parseFloat(bestWeek.week_revenue),
        total_guests_booked: totalBooked,
        total_guests_turned_away: totalRejected,
        total_cancellations: totalCancellations,
        total_no_shows: totalNoShows,
        weeks_played: history.length,
      },
    });
  } catch (err) { next(err); }
});

// 8b. GET /:id/insights — pricing analytics for educational insights page
router.get('/:id/insights', async (req, res, next) => {
  try {
    const history = await weeklyScoreRepository.getHistory(req.params.id, req.user.id);
    const weeks = await weekRepository.findAllBySession(req.params.id);

    // Aggregate guest data across all weeks for WTP analysis
    const allGuests = [];
    for (const week of weeks) {
      const guests = typeof week.guests_json === 'string'
        ? JSON.parse(week.guests_json)
        : week.guests_json;
      if (guests) allGuests.push(...guests);
    }

    // Segment breakdown
    const segmentMap = {};
    for (const g of allGuests) {
      const seg = g.market_segment || 'Unknown';
      if (!segmentMap[seg]) segmentMap[seg] = { count: 0, totalAdr: 0, avgAdr: 0 };
      segmentMap[seg].count += 1;
      segmentMap[seg].totalAdr += g.adr_predicted || 0;
    }
    for (const seg of Object.keys(segmentMap)) {
      segmentMap[seg].avgAdr = parseFloat((segmentMap[seg].totalAdr / segmentMap[seg].count).toFixed(2));
    }

    // ADR distribution for WTP analysis (histogram buckets)
    const adrBuckets = {};
    for (const g of allGuests) {
      const bucket = Math.floor((g.adr_predicted || 0) / 25) * 25;
      adrBuckets[bucket] = (adrBuckets[bucket] || 0) + 1;
    }

    // Room tier ADR distribution
    const tierMap = { 1: 'standard', 2: 'mid', 3: 'premium', 4: 'suite' };
    const tierAdrDist = { standard: [], mid: [], premium: [], suite: [] };
    for (const g of allGuests) {
      const tier = tierMap[g.room_tier] || 'standard';
      tierAdrDist[tier].push(g.adr_predicted || 0);
    }

    // Compute optimal prices per tier (price that maximizes revenue)
    // ─── Aggregate (kept for backward compat) ───
    const optimalPrices = {};
    for (const [tier, adrs] of Object.entries(tierAdrDist)) {
      if (adrs.length === 0) { optimalPrices[tier] = 0; continue; }
      adrs.sort((a, b) => a - b);
      let bestPrice = 0, bestRevenue = 0;
      for (let i = 0; i < adrs.length; i++) {
        const price = adrs[i];
        const guestsAtPrice = adrs.filter(a => a >= price).length;
        const revenue = price * guestsAtPrice;
        if (revenue > bestRevenue) {
          bestRevenue = revenue;
          bestPrice = price;
        }
      }
      optimalPrices[tier] = Math.round(bestPrice);
    }

    // ─── Per-week optimal prices ───
    // Build a lookup of player-set prices per week from weekly_scores
    const playerPricesMap = {};
    for (const h of history) {
      if (h.prices_json) {
        const parsed = typeof h.prices_json === 'string' ? JSON.parse(h.prices_json) : h.prices_json;
        playerPricesMap[parseInt(h.week_number, 10)] = parsed;
      }
    }

    const weeklyOptimalPrices = [];
    for (const week of weeks) {
      const guests = typeof week.guests_json === 'string'
        ? JSON.parse(week.guests_json)
        : week.guests_json;
      if (!guests || guests.length === 0) continue;

      const weekTierAdrs = { standard: [], mid: [], premium: [], suite: [] };
      for (const g of guests) {
        const tier = tierMap[g.room_tier] || 'standard';
        weekTierAdrs[tier].push(g.adr_predicted || 0);
      }

      const weekOptimal = {};
      let weekOptimalRevenue = 0;
      for (const [tier, adrs] of Object.entries(weekTierAdrs)) {
        if (adrs.length === 0) { weekOptimal[tier] = 0; continue; }
        adrs.sort((a, b) => a - b);
        let bestPrice = 0, bestRev = 0;
        for (let i = 0; i < adrs.length; i++) {
          const price = adrs[i];
          const willing = adrs.filter(a => a >= price).length;
          const rev = price * willing;
          if (rev > bestRev) {
            bestRev = rev;
            bestPrice = price;
          }
        }
        weekOptimal[tier] = Math.round(bestPrice);
        weekOptimalRevenue += bestRev;
      }

      weeklyOptimalPrices.push({
        week_number: week.week_number,
        prices: weekOptimal,
        player_prices: playerPricesMap[week.week_number] || null,
        guest_count: guests.length,
        optimal_revenue: Math.round(weekOptimalRevenue),
      });
    }

    // Summary stats
    const totalGuests = allGuests.length;
    const totalBooked = history.reduce((s, w) => s + parseInt(w.guests_accepted || 0, 10), 0);
    const totalTurnedAway = history.reduce((s, w) => s + parseInt(w.guests_rejected || 0, 10), 0);
    const totalCancellations = history.reduce((s, w) => s + parseInt(w.cancellations || 0, 10), 0);
    const totalNoShows = history.reduce((s, w) => s + parseInt(w.no_shows || 0, 10), 0);
    const avgOcc = history.length > 0
      ? history.reduce((s, w) => s + parseFloat(w.occupancy_rate || 0), 0) / history.length
      : 0;
    const totalRevenue = history.reduce((s, w) => s + parseFloat(w.week_revenue || 0), 0);

    // ─── Dynamic Strategy Analysis ──────────────────────────────────────
    const bookingRate = totalGuests > 0 ? totalBooked / totalGuests : 0;
    const cancellationRate = totalBooked > 0 ? totalCancellations / totalBooked : 0;
    const noshowRate = totalBooked > 0 ? totalNoShows / totalBooked : 0;
    const lossRate = cancellationRate + noshowRate;
    const avgOccPct = avgOcc * 100;

    // Occupancy trend: compare first half vs second half
    let occTrend = 'stable';
    if (history.length >= 4) {
      const mid = Math.floor(history.length / 2);
      const firstHalfOcc = history.slice(0, mid).reduce((s, w) => s + parseFloat(w.occupancy_rate || 0), 0) / mid;
      const secondHalfOcc = history.slice(mid).reduce((s, w) => s + parseFloat(w.occupancy_rate || 0), 0) / (history.length - mid);
      if (secondHalfOcc > firstHalfOcc + 0.08) occTrend = 'improving';
      else if (secondHalfOcc < firstHalfOcc - 0.08) occTrend = 'declining';
    }

    // Revenue trend: same approach
    let revTrend = 'stable';
    if (history.length >= 4) {
      const mid = Math.floor(history.length / 2);
      const firstHalfRev = history.slice(0, mid).reduce((s, w) => s + parseFloat(w.week_revenue || 0), 0) / mid;
      const secondHalfRev = history.slice(mid).reduce((s, w) => s + parseFloat(w.week_revenue || 0), 0) / (history.length - mid);
      if (secondHalfRev > firstHalfRev * 1.1) revTrend = 'improving';
      else if (secondHalfRev < firstHalfRev * 0.9) revTrend = 'declining';
    }

    // Compute actual revenue vs optimal revenue
    let optimalRevenue = 0;
    for (const [tier, adrs] of Object.entries(tierAdrDist)) {
      if (adrs.length === 0) continue;
      const sorted = [...adrs].sort((a, b) => a - b);
      for (let i = 0; i < sorted.length; i++) {
        const price = sorted[i];
        const guests = sorted.filter(a => a >= price).length;
        const rev = price * guests;
        if (rev > optimalRevenue) optimalRevenue = rev;
      }
    }
    const revenueEfficiency = optimalRevenue > 0 ? totalRevenue / optimalRevenue : 0;

    // Determine strategy profile from multiple factors
    let strategyProfile, strategyDescription;
    if (avgOccPct >= 75 && bookingRate > 0.6) {
      strategyProfile = 'Volume Maximizer';
      strategyDescription = `You filled ${Math.round(avgOccPct)}% of rooms on average by setting accessible prices. ${
        revenueEfficiency < 0.5
          ? 'However, you captured only ' + Math.round(revenueEfficiency * 100) + '% of potential revenue — many guests would have paid more.'
          : 'Your revenue efficiency is solid at ' + Math.round(revenueEfficiency * 100) + '% of theoretical maximum.'
      }`;
    } else if (avgOccPct < 45 && bookingRate < 0.35) {
      strategyProfile = 'Yield Optimizer';
      strategyDescription = `You priced aggressively, achieving only ${Math.round(avgOccPct)}% occupancy but targeting high-value guests. ${
        revenueEfficiency > 0.6
          ? 'This premium approach captured ' + Math.round(revenueEfficiency * 100) + '% of potential revenue efficiently.'
          : 'Unfortunately, lost volume outweighed margin gains — only ' + Math.round(revenueEfficiency * 100) + '% of optimal revenue was captured.'
      }`;
    } else if (occTrend === 'improving' && revTrend === 'improving') {
      strategyProfile = 'Adaptive Learner';
      strategyDescription = `Your performance improved over time — occupancy went ${occTrend} and revenue went ${revTrend}. You adapted your pricing strategy based on market feedback, which is the hallmark of good revenue management.`;
    } else if (lossRate > 0.25) {
      strategyProfile = 'Risk Taker';
      strategyDescription = `${Math.round(lossRate * 100)}% of your bookings were lost to cancellations (${totalCancellations}) and no-shows (${totalNoShows}). While you attracted volume, the high-risk guest mix eroded realized revenue.`;
    } else {
      strategyProfile = 'Balanced Strategist';
      strategyDescription = `You balanced occupancy (${Math.round(avgOccPct)}%) with pricing across ${history.length} weeks, capturing ${Math.round(revenueEfficiency * 100)}% of theoretical revenue. ${
        occTrend === 'declining'
          ? 'Your occupancy trended down in later weeks — the market may have shifted.'
          : occTrend === 'improving'
            ? 'Encouragingly, your performance improved over time.'
            : 'Performance was consistent throughout the simulation.'
      }`;
    }

    // ─── Dynamic Key Takeaway ───────────────────────────────────────────
    // Pick the most impactful area for improvement
    const issues = [];

    if (avgOccPct < 50) {
      issues.push({ priority: 3, text: `Your average occupancy was just ${Math.round(avgOccPct)}%. Try lowering prices by $10-20 on your weakest-performing tier to fill more rooms.` });
    }
    if (avgOccPct > 85 && revenueEfficiency < 0.6) {
      issues.push({ priority: 4, text: `Rooms were almost always full (${Math.round(avgOccPct)}% occ) but price efficiency was only ${Math.round(revenueEfficiency * 100)}%. You could raise prices significantly and still fill most rooms.` });
    }
    if (lossRate > 0.2) {
      issues.push({ priority: 2, text: `${Math.round(lossRate * 100)}% of bookings were lost to cancellations/no-shows. In real revenue management, overbooking or requiring deposits can mitigate this risk.` });
    }
    if (totalTurnedAway > totalBooked * 0.5) {
      issues.push({ priority: 3, text: `You turned away ${totalTurnedAway} guests — more than half of those who booked. Many of these would have added revenue at a slightly lower price point.` });
    }
    if (occTrend === 'declining') {
      issues.push({ priority: 2, text: `Your occupancy declined in the second half. This could indicate your prices didn't adapt to changing demand levels — monitor the demand indicator each week.` });
    }
    if (revTrend === 'improving') {
      issues.push({ priority: 1, text: `Great news — your revenue improved over time. You learned to read the market! Keep experimenting with price differentiation across tiers.` });
    }

    // Find worst-performing tier
    const tierPerformance = {};
    for (const [tier, adrs] of Object.entries(tierAdrDist)) {
      if (adrs.length === 0) continue;
      const optPrice = optimalPrices[tier] || 0;
      const medianWTP = adrs.length ? adrs[Math.floor(adrs.length / 2)] : 0;
      tierPerformance[tier] = { optPrice, medianWTP, gap: Math.abs(optPrice - medianWTP) };
    }

    // Fallback takeaway
    if (issues.length === 0) {
      issues.push({ priority: 1, text: `Solid performance across the board. To push further, try setting different prices for each tier rather than uniform pricing — price discrimination is the key to advanced revenue management.` });
    }

    // Sort by priority descending and pick the most impactful
    issues.sort((a, b) => b.priority - a.priority);
    const keyTakeaway = issues[0].text;

    res.json({
      totalGuests,
      totalBooked,
      totalTurnedAway,
      totalCancellations,
      totalNoShows,
      bookingRate: parseFloat((bookingRate * 100).toFixed(1)),
      avgOccupancy: parseFloat((avgOccPct).toFixed(1)),
      revenueEfficiency: parseFloat((revenueEfficiency * 100).toFixed(1)),
      cancellationRate: parseFloat((cancellationRate * 100).toFixed(1)),
      occTrend,
      revTrend,
      segments: segmentMap,
      adrDistribution: adrBuckets,
      tierAdrDistribution: Object.fromEntries(
        Object.entries(tierAdrDist).map(([k, v]) => [k, {
          count: v.length,
          min: v.length ? Math.round(Math.min(...v)) : 0,
          max: v.length ? Math.round(Math.max(...v)) : 0,
          median: v.length ? Math.round(v[Math.floor(v.length / 2)]) : 0,
          avg: v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : 0,
        }])
      ),
      optimalPrices,
      weeklyOptimalPrices,
      strategyProfile,
      strategyDescription,
      keyTakeaway,
    });
  } catch (err) { next(err); }
});

// 8c. GET /:id/kpis — KPI dashboard data (RevPAR, ADR, Yield, etc.)
router.get('/:id/kpis', async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const session = await require('../repositories/sessionRepository').findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);

    const history = await weeklyScoreRepository.getHistory(sessionId, req.user.id);
    const weeks = await weekRepository.findAllBySession(sessionId);

    const gameMode = session.game_mode || 'pricing';
    const hotelType = session.hotel_type || 'city';
    const { HOTEL_INVENTORY, CLASSIC_INVENTORY } = require('../services/roomInventoryService');
    const inventory = gameMode === 'classic'
      ? (CLASSIC_INVENTORY[hotelType] || CLASSIC_INVENTORY.city)
      : (HOTEL_INVENTORY[hotelType] || HOTEL_INVENTORY.city);
    const totalRooms = Object.values(inventory).reduce((s, n) => s + n, 0);
    const totalRoomNights = totalRooms * 7;

    // Compute week-by-week KPIs
    const kpiWeeks = history.map(w => {
      const revenue = parseFloat(w.week_revenue || 0);
      const accepted = parseInt(w.guests_accepted || 0, 10);
      const cancellations = parseInt(w.cancellations || 0, 10);
      const noShows = parseInt(w.no_shows || 0, 10);
      const checkedOut = accepted - cancellations - noShows;
      const occupancy = parseFloat(w.occupancy_rate || 0);

      const revpar = totalRoomNights > 0 ? revenue / totalRoomNights : 0;
      const adr = checkedOut > 0 ? revenue / checkedOut : 0;
      const cancRate = accepted > 0 ? cancellations / accepted : 0;
      const noshowRate = accepted > 0 ? noShows / accepted : 0;

      return {
        week: parseInt(w.week_number, 10),
        revenue: parseFloat(revenue.toFixed(2)),
        cumulative: parseFloat(w.cumulative_revenue || 0),
        revpar: parseFloat(revpar.toFixed(2)),
        adr: parseFloat(adr.toFixed(2)),
        occupancy: parseFloat((occupancy * 100).toFixed(1)),
        cancellation_rate: parseFloat((cancRate * 100).toFixed(1)),
        noshow_rate: parseFloat((noshowRate * 100).toFixed(1)),
        accepted,
        rejected: parseInt(w.guests_rejected || 0, 10),
        cancellations,
        no_shows: noShows,
        checked_out: Math.max(0, checkedOut),
      };
    });

    // Aggregates
    const totalRevenue = kpiWeeks.reduce((s, w) => s + w.revenue, 0);
    const avgRevpar = kpiWeeks.length > 0 ? kpiWeeks.reduce((s, w) => s + w.revpar, 0) / kpiWeeks.length : 0;
    const avgAdr = kpiWeeks.length > 0 ? kpiWeeks.reduce((s, w) => s + w.adr, 0) / kpiWeeks.length : 0;
    const avgOccupancy = kpiWeeks.length > 0 ? kpiWeeks.reduce((s, w) => s + w.occupancy, 0) / kpiWeeks.length : 0;
    const totalAccepted = kpiWeeks.reduce((s, w) => s + w.accepted, 0);
    const totalCheckedOut = kpiWeeks.reduce((s, w) => s + w.checked_out, 0);
    const totalCancellations = kpiWeeks.reduce((s, w) => s + w.cancellations, 0);
    const totalNoShows = kpiWeeks.reduce((s, w) => s + w.no_shows, 0);
    const yieldIndex = totalRoomNights * kpiWeeks.length > 0
      ? totalRevenue / (avgAdr * totalRoomNights * kpiWeeks.length) * 100
      : 0;

    // Segment breakdown across all weeks
    const allGuests = [];
    for (const week of weeks) {
      const guests = typeof week.guests_json === 'string'
        ? JSON.parse(week.guests_json) : week.guests_json;
      if (guests) allGuests.push(...guests);
    }
    const segmentBreakdown = {};
    for (const g of allGuests) {
      const seg = g.market_segment || 'Unknown';
      if (!segmentBreakdown[seg]) segmentBreakdown[seg] = { count: 0, revenue: 0, avgEv: 0 };
      segmentBreakdown[seg].count += 1;
      segmentBreakdown[seg].revenue += g.revenue_offered || 0;
      segmentBreakdown[seg].avgEv += g.expected_value || 0;
    }
    for (const seg of Object.keys(segmentBreakdown)) {
      const s = segmentBreakdown[seg];
      s.avgEv = s.count > 0 ? parseFloat((s.avgEv / s.count).toFixed(2)) : 0;
      s.revenue = parseFloat(s.revenue.toFixed(2));
    }

    res.json({
      hotel_type: hotelType,
      game_mode: gameMode,
      total_rooms: totalRooms,
      total_room_nights: totalRoomNights,
      weeks_played: kpiWeeks.length,
      weeks: kpiWeeks,
      summary: {
        total_revenue: parseFloat(totalRevenue.toFixed(2)),
        avg_revpar: parseFloat(avgRevpar.toFixed(2)),
        avg_adr: parseFloat(avgAdr.toFixed(2)),
        avg_occupancy: parseFloat(avgOccupancy.toFixed(1)),
        yield_index: parseFloat(yieldIndex.toFixed(1)),
        total_accepted: totalAccepted,
        total_checked_out: totalCheckedOut,
        total_cancellations: totalCancellations,
        total_no_shows: totalNoShows,
      },
      segments: segmentBreakdown,
      inventory,
    });
  } catch (err) { next(err); }
});

// 8d. GET /:id/benchmark — AI benchmark comparison
router.get('/:id/benchmark', async (req, res, next) => {
  try {
    const sessionId = req.params.id;
    const session = await require('../repositories/sessionRepository').findById(sessionId);
    if (!session) throw new AppError('Session not found', 404);

    const benchmarkService = require('../services/benchmarkService');
    const benchmark = await benchmarkService.computeBenchmark(
      sessionId,
      session.game_mode || 'pricing',
      session.hotel_type || 'city'
    );

    // Get player's results for comparison
    const history = await weeklyScoreRepository.getHistory(sessionId, req.user.id);
    const playerRevenue = history.reduce((s, w) => s + parseFloat(w.week_revenue || 0), 0);

    const efficiency = benchmark && benchmark.ai_total_revenue > 0
      ? (playerRevenue / benchmark.ai_total_revenue) * 100
      : 0;

    res.json({
      player_revenue: parseFloat(playerRevenue.toFixed(2)),
      ai_revenue: benchmark?.ai_total_revenue || 0,
      efficiency: parseFloat(efficiency.toFixed(1)),
      ai_strategy: benchmark?.ai_strategy || 'N/A',
      ai_weeks: benchmark?.ai_weeks || [],
      player_weeks: history.map(w => ({
        week: parseInt(w.week_number, 10),
        revenue: parseFloat(w.week_revenue || 0),
        cumulative: parseFloat(w.cumulative_revenue || 0),
        occupancy: parseFloat(w.occupancy_rate || 0),
      })),
    });
  } catch (err) { next(err); }
});

// 9. DELETE /:id — delete a session
router.delete('/:id', async (req, res, next) => {
  try {
    await sessionService.deleteSession(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// 10. GET /:id — get session details (MUST BE LAST)
router.get('/:id', async (req, res, next) => {
  try {
    const session = await sessionService.getSession(req.params.id, req.user.id);
    res.json(session);
  } catch (err) { next(err); }
});

module.exports = router;
