const redis = require('../config/redis');
const redisKeys = require('../config/redisKeys');
const roomInventoryService = require('./roomInventoryService');
const bookingRepository = require('../repositories/bookingRepository');
const weekRepository = require('../repositories/weekRepository');
const sessionRepository = require('../repositories/sessionRepository');
const { HOTEL_INVENTORY } = require('./roomInventoryService');
const AppError = require('../utils/AppError');

const TIER_MAP = { 1: 'standard', 2: 'mid', 3: 'premium', 4: 'suite' };

/**
 * Process submitted prices: auto-book guests, resolve outcomes, calculate revenue.
 *
 * @param {Object} opts
 * @param {string} opts.sessionId
 * @param {number} opts.weekId
 * @param {string} opts.userId
 * @param {Object} opts.prices - { standard: Number, mid: Number, premium: Number, suite: Number }
 * @returns {Object} Simulation results
 */
async function simulateWeek({ sessionId, weekId, userId, prices }) {
  // 1. Load week guests
  const week = await weekRepository.findById(weekId);
  if (!week) throw new AppError('Week not found', 404);

  const guests = typeof week.guests_json === 'string'
    ? JSON.parse(week.guests_json) : week.guests_json;

  // 2. Sort guests by revenue_offered descending (highest-paying guests try to book first)
  const sortedGuests = guests.map((g, i) => ({ ...g, originalIndex: i }))
    .sort((a, b) => b.revenue_offered - a.revenue_offered);

  // 3. Get current calendar from Redis (initialized fresh each week by weekOrchestrator)
  const calendar = await roomInventoryService.getCalendar(sessionId, userId);

  const booked = [];
  const turnedAway = [];

  for (const guest of sortedGuests) {
    const tierName = TIER_MAP[guest.room_tier] || 'standard';
    const playerPrice = prices[tierName] || 0;

    // Guest books if their willingness to pay (ADR) >= player's price
    if (guest.adr_predicted >= playerPrice) {
      const arrivalDay = guest.arrival_day || 1;
      const los = guest.los || 1;

      // Check room availability for the full LOS
      const canFit = _checkAvailability(calendar, tierName, arrivalDay, los);

      if (canFit) {
        // Occupy rooms in calendar
        _occupyRooms(calendar, tierName, arrivalDay, los);

        // Revenue = player's price × LOS (player earns what they charge, not what guest was willing to pay)
        const revenueOffered = parseFloat((playerPrice * los).toFixed(2));

        // Insert accepted booking
        await bookingRepository.insert({
          session_id: sessionId,
          week_id: weekId,
          user_id: userId,
          guest_index: guest.originalIndex,
          decision: 'accepted',
          room_tier: String(guest.room_tier),
          decided_at: new Date(),
          expected_value: parseFloat((revenueOffered * (1 - (guest.p_cancel || 0))).toFixed(2)),
        });

        booked.push({ ...guest, revenue_at_player_price: revenueOffered });
      } else {
        // Willing to pay but no rooms available
        turnedAway.push({ ...guest, reason: 'no_rooms' });
      }
    } else {
      // Guest's ADR < player's price — priced out
      turnedAway.push({ ...guest, reason: 'priced_out' });
    }
  }

  // 4. Save updated calendar to Redis
  await roomInventoryService.setCalendar(sessionId, userId, calendar);

  // 5. Resolve booked guests (apply cancellation and no-show probabilities)
  const resolvedResults = _resolveBookings(booked);

  // 6. Update each booking's outcome in DB
  const acceptedBookings = await bookingRepository.findAccepted(weekId);
  for (const resolved of resolvedResults) {
    const booking = acceptedBookings.find(b => b.guest_index === resolved.originalIndex);
    if (booking) {
      await bookingRepository.updateOutcome(booking.id, {
        outcome: resolved.outcome,
        revenue_realized: resolved.revenue_realized,
        resolved_at: new Date(),
      });
    }
  }

  // 7. Calculate aggregate stats
  const totalRevenue = resolvedResults.reduce((sum, r) => sum + r.revenue_realized, 0);
  const guestsCheckedOut = resolvedResults.filter(r => r.outcome === 'checked_out').length;
  const cancellations = resolvedResults.filter(r => r.outcome === 'cancelled').length;
  const noShows = resolvedResults.filter(r => r.outcome === 'no_show').length;

  // Per-tier breakdown
  const tierStats = {};
  for (const tierName of Object.values(TIER_MAP)) {
    const tierBooked = booked.filter(g => (TIER_MAP[g.room_tier] || 'standard') === tierName);
    const tierTurnedAway = turnedAway.filter(g => (TIER_MAP[g.room_tier] || 'standard') === tierName);
    const tierResolved = resolvedResults.filter(g => (TIER_MAP[g.room_tier] || 'standard') === tierName);
    const tierRevenue = tierResolved.reduce((sum, r) => sum + r.revenue_realized, 0);

    tierStats[tierName] = {
      price_set: prices[tierName] || 0,
      guests_booked: tierBooked.length,
      guests_turned_away: tierTurnedAway.length,
      priced_out: tierTurnedAway.filter(g => g.reason === 'priced_out').length,
      no_rooms: tierTurnedAway.filter(g => g.reason === 'no_rooms').length,
      revenue: parseFloat(tierRevenue.toFixed(2)),
    };
  }

  // Occupancy calculation
  const session = await sessionRepository.findById(sessionId);
  const hotelType = session ? session.hotel_type : 'city';
  const inv = HOTEL_INVENTORY[hotelType] || HOTEL_INVENTORY.city;
  const totalRoomNights = Object.values(inv).reduce((sum, n) => sum + n, 0) * 7;
  // Count actual room-nights sold (sum of LOS for checked-out guests)
  const roomNightsSold = resolvedResults
    .filter(r => r.outcome === 'checked_out')
    .reduce((sum, r) => sum + (r.los || 1), 0);

  // ADR = total revenue / room-nights sold
  const adr = roomNightsSold > 0 ? parseFloat((totalRevenue / roomNightsSold).toFixed(2)) : 0;
  const revpar = totalRoomNights > 0 ? parseFloat((totalRevenue / totalRoomNights).toFixed(2)) : 0;

  return {
    week_revenue: parseFloat(totalRevenue.toFixed(2)),
    guests_total: guests.length,
    guests_booked: booked.length,
    guests_turned_away: turnedAway.length,
    guests_checked_out: guestsCheckedOut,
    cancellations,
    no_shows: noShows,
    occupancy_rate: parseFloat((roomNightsSold / Math.max(1, totalRoomNights)).toFixed(4)),
    adr,
    revpar,
    tier_stats: tierStats,
    calendar,
    prices_submitted: prices,
  };
}

// ─── Private helpers ────────────────────────────────────────────────────

function _checkAvailability(calendar, tierName, arrivalDay, los) {
  const days = calendar[tierName];
  if (!days) return false;
  for (let d = arrivalDay - 1; d < Math.min(arrivalDay - 1 + los, 7); d++) {
    if (d < 0 || d >= days.length) continue;
    if (days[d] <= 0) return false;
  }
  return true;
}

function _occupyRooms(calendar, tierName, arrivalDay, los) {
  const days = calendar[tierName];
  for (let d = arrivalDay - 1; d < Math.min(arrivalDay - 1 + los, 7); d++) {
    if (d >= 0 && d < days.length) {
      days[d] -= 1;
    }
  }
}

function _resolveBookings(bookedGuests) {
  return bookedGuests.map(guest => {
    const revenue = guest.revenue_at_player_price;

    // Cancellation check
    if (Math.random() < (guest.p_cancel || 0)) {
      // Cancelled — partial recovery (30% for non-refundable deposits)
      const recoveryRate = guest.is_non_refund ? 0.5 : 0.3;
      return {
        ...guest,
        outcome: 'cancelled',
        revenue_realized: parseFloat((revenue * recoveryRate).toFixed(2)),
      };
    }

    // No-show check
    if (Math.random() < (guest.p_noshow || 0)) {
      return { ...guest, outcome: 'no_show', revenue_realized: 0 };
    }

    // Successful checkout
    return { ...guest, outcome: 'checked_out', revenue_realized: revenue };
  });
}

module.exports = { simulateWeek };
