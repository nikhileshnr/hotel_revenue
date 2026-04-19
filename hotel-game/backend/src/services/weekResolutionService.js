const { getConfig } = require('../demand/modelLoader');
const { HOTEL_INVENTORY } = require('./roomInventoryService');

function resolveBookings(acceptedBookings, guests_json) {
  const config = getConfig();
  const recoveryRates = config.cancellation_revenue_recovery;
  const results = [];

  for (const booking of acceptedBookings) {
    const guest = guests_json[booking.guest_index];
    if (!guest) continue;

    let outcome;
    let revenue_realized;

    // Sample cancellation
    if (Math.random() < guest.p_cancel) {
      outcome = 'cancelled';
      const rate = recoveryRates[guest.deposit_type] || 0;
      revenue_realized = parseFloat((guest.revenue_offered * rate).toFixed(2));
    }
    // Sample no-show
    else if (Math.random() < guest.p_noshow) {
      outcome = 'no_show';
      revenue_realized = 0;
    }
    // Checked out successfully
    else {
      outcome = 'checked_out';
      revenue_realized = guest.revenue_offered;
    }

    results.push({
      bookingId: booking.id,
      userId: booking.user_id,
      outcome,
      revenue_realized,
    });
  }

  return results;
}

function aggregateByPlayer(resolvedOutcomes, hotelType) {
  const map = {};

  for (const r of resolvedOutcomes) {
    if (!map[r.userId]) {
      map[r.userId] = {
        week_revenue: 0,
        cancellations: 0,
        no_shows: 0,
        guests_accepted: 0,
        occupancy_rate: 0,
      };
    }
    const stats = map[r.userId];
    stats.guests_accepted += 1;
    stats.week_revenue += r.revenue_realized;

    if (r.outcome === 'cancelled') stats.cancellations += 1;
    if (r.outcome === 'no_show') stats.no_shows += 1;
  }

  // Compute occupancy rate
  const inventory = HOTEL_INVENTORY[hotelType] || HOTEL_INVENTORY.city;
  const totalRooms = Object.values(inventory).reduce((sum, n) => sum + n, 0);
  const totalAvailableRoomNights = totalRooms * 7; // 7 days per week

  // Round revenues and compute occupancy
  for (const userId of Object.keys(map)) {
    map[userId].week_revenue = parseFloat(map[userId].week_revenue.toFixed(2));

    const roomsSold = map[userId].guests_accepted - map[userId].cancellations - map[userId].no_shows;
    map[userId].occupancy_rate = parseFloat(
      (Math.max(0, roomsSold) / totalAvailableRoomNights).toFixed(4)
    );
  }

  return map;
}

module.exports = { resolveBookings, aggregateByPlayer };
