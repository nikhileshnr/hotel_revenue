const weekRepository = require('../repositories/weekRepository');
const bookingRepository = require('../repositories/bookingRepository');
const { HOTEL_INVENTORY, CLASSIC_INVENTORY } = require('./roomInventoryService');

/**
 * Compute AI benchmark for a completed session.
 * The AI plays the same guest data using a simple optimal strategy.
 */
async function computeBenchmark(sessionId, gameMode, hotelType) {
  const weeks = await weekRepository.findAllBySession(sessionId);
  if (!weeks || weeks.length === 0) return null;

  const inventory = gameMode === 'classic'
    ? (CLASSIC_INVENTORY[hotelType] || CLASSIC_INVENTORY.city)
    : (HOTEL_INVENTORY[hotelType] || HOTEL_INVENTORY.city);

  const totalRooms = Object.values(inventory).reduce((s, n) => s + n, 0);
  const totalRoomNights = totalRooms * 7;

  const TIER_MAP = { 1: 'standard', 2: 'mid', 3: 'premium', 4: 'suite' };

  const aiWeeks = [];
  let aiCumulativeRevenue = 0;

  for (const week of weeks) {
    const guests = typeof week.guests_json === 'string'
      ? JSON.parse(week.guests_json) : week.guests_json;
    if (!guests || guests.length === 0) continue;

    // Build a fresh calendar for this week
    const calendar = {};
    for (const [tierName, cap] of Object.entries(inventory)) {
      calendar[tierName] = Array(7).fill(cap);
    }

    // AI strategy: sort by expected_value descending, accept greedily if room fits
    const sorted = [...guests].sort((a, b) => (b.expected_value || 0) - (a.expected_value || 0));

    let weekRevenue = 0;
    let accepted = 0;
    let rejected = 0;
    let cancellations = 0;
    let noShows = 0;
    let checkedOut = 0;

    for (const guest of sorted) {
      const tierName = TIER_MAP[guest.room_tier] || 'standard';
      const arrDay = (guest.arrival_day || 1) - 1; // 0-indexed
      const los = guest.los || 1;
      const endDay = Math.min(arrDay + los, 7);

      // Check if room available for all days of stay
      let canFit = true;
      for (let d = arrDay; d < endDay; d++) {
        if ((calendar[tierName]?.[d] || 0) <= 0) { canFit = false; break; }
      }

      // AI rejects high-risk low-value guests
      const medianEV = sorted[Math.floor(sorted.length / 2)]?.expected_value || 0;
      if (guest.risk_badge === 'red' && (guest.expected_value || 0) < medianEV * 0.7) {
        rejected++;
        continue;
      }

      if (!canFit) {
        rejected++;
        continue;
      }

      // Accept: occupy rooms
      for (let d = arrDay; d < endDay; d++) {
        calendar[tierName][d] -= 1;
      }

      // Resolve outcome (same as weekResolutionService)
      if (Math.random() < (guest.p_cancel || 0)) {
        cancellations++;
        const recovery = guest.deposit_type === 'Non Refund' ? 0.5 : 0;
        weekRevenue += (guest.revenue_offered || 0) * recovery;
      } else if (Math.random() < (guest.p_noshow || 0)) {
        noShows++;
      } else {
        checkedOut++;
        weekRevenue += guest.revenue_offered || 0;
      }
      accepted++;
    }

    weekRevenue = parseFloat(weekRevenue.toFixed(2));
    aiCumulativeRevenue += weekRevenue;

    const roomsSold = accepted - cancellations - noShows;
    const occupancy = totalRoomNights > 0 ? Math.max(0, roomsSold) / totalRoomNights : 0;
    const adr = checkedOut > 0 ? weekRevenue / checkedOut : 0;
    const revpar = totalRoomNights > 0 ? weekRevenue / totalRoomNights : 0;

    aiWeeks.push({
      week_number: week.week_number,
      revenue: weekRevenue,
      cumulative: parseFloat(aiCumulativeRevenue.toFixed(2)),
      occupancy: parseFloat(occupancy.toFixed(4)),
      adr: parseFloat(adr.toFixed(2)),
      revpar: parseFloat(revpar.toFixed(2)),
      accepted,
      rejected,
      cancellations,
      no_shows: noShows,
      checked_out: checkedOut,
    });
  }

  return {
    ai_total_revenue: parseFloat(aiCumulativeRevenue.toFixed(2)),
    ai_weeks: aiWeeks,
    ai_strategy: 'Greedy Expected Value',
    total_rooms: totalRooms,
  };
}

module.exports = { computeBenchmark };
