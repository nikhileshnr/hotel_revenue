---
phase: 8
name: Backend Pricing Engine
wave: 1
depends_on: []
files_modified:
  - hotel-game/backend/src/services/pricingService.js
  - hotel-game/backend/src/game/weekOrchestrator.js
  - hotel-game/backend/src/socket/handlers/gameHandler.js
  - hotel-game/backend/src/socket/handlers/decisionHandler.js
  - hotel-game/backend/src/services/weekResolutionService.js
autonomous: true
requirements: [PRICE-01, PRICE-02, PRICE-03, FLOW-01, FLOW-02, FLOW-03]
---

# Phase 8: Backend Pricing Engine

## Goal
Replace the accept/reject per-guest decision mechanic with a pricing-strategy mechanic:
1. Student submits prices for 4 room tiers before each week
2. Backend generates guests, auto-books those whose ADR ≤ player's price
3. Cancellation/no-show applied, revenue calculated, results emitted

## must_haves
- `player:submit_prices` socket event stores prices and triggers simulation
- Auto-booking logic: guest books if `guest.adr_predicted <= player_price[guest.room_tier]`
- Week results include revenue, occupancy, guests_booked, guests_turned_away per tier
- Full game loop: week_started → prices submitted → simulation → week:results → advance

---

## Task 1: Create pricingService.js

<read_first>
- hotel-game/backend/src/services/decisionService.js (current pattern to replace)
- hotel-game/backend/src/services/roomInventoryService.js (HOTEL_INVENTORY, calendar helpers)
- hotel-game/backend/src/services/weekResolutionService.js (resolveBookings pattern)
- hotel-game/backend/src/demand/guestFactory.js (guest object shape — adr_predicted, room_tier, los, arrival_day, p_cancel, p_noshow)
</read_first>

<action>
Create `hotel-game/backend/src/services/pricingService.js` with:

```javascript
const redis = require('../config/redis');
const redisKeys = require('../config/redisKeys');
const roomInventoryService = require('./roomInventoryService');
const bookingRepository = require('../repositories/bookingRepository');
const weekRepository = require('../repositories/weekRepository');
const { HOTEL_INVENTORY } = require('./roomInventoryService');
const AppError = require('../utils/AppError');

const TIER_MAP = { 1: 'standard', 2: 'mid', 3: 'premium', 4: 'suite' };

/**
 * Process submitted prices: generate auto-bookings, resolve outcomes, calculate revenue.
 * Returns { results, weekCalendar } for the week.
 */
async function simulateWeek({ sessionId, weekId, userId, prices }) {
  // prices = { standard: 120, mid: 180, premium: 280, suite: 450 }

  // 1. Load week guests
  const week = await weekRepository.findById(weekId);
  const guests = typeof week.guests_json === 'string' 
    ? JSON.parse(week.guests_json) : week.guests_json;

  // 2. Sort guests by revenue_offered descending (highest-paying first)
  const sortedGuests = guests.map((g, i) => ({ ...g, originalIndex: i }))
    .sort((a, b) => b.revenue_offered - a.revenue_offered);

  // 3. Build fresh calendar for room availability tracking
  const calendar = {}; // Track available rooms per tier per day
  // Get from Redis (already initialized by weekOrchestrator)
  const existingCalendar = await roomInventoryService.getCalendar(sessionId, userId);
  Object.assign(calendar, existingCalendar);

  const booked = [];
  const turnedAway = [];

  for (const guest of sortedGuests) {
    const tierName = TIER_MAP[guest.room_tier] || 'standard';
    const playerPrice = prices[tierName];

    // Guest books if their ADR (willingness to pay) >= player's price
    if (guest.adr_predicted >= playerPrice) {
      // Check room availability for the LOS
      const canFit = _checkAvailability(calendar, tierName, guest.arrival_day || 1, guest.los || 1);

      if (canFit) {
        // Occupy rooms in calendar
        _occupyRooms(calendar, tierName, guest.arrival_day || 1, guest.los || 1);
        
        // Revenue is based on the PLAYER'S price (not guest's ADR)
        const revenueOffered = playerPrice * (guest.los || 1);

        // Insert booking
        await bookingRepository.insert({
          session_id: sessionId,
          week_id: weekId,
          user_id: userId,
          guest_index: guest.originalIndex,
          decision: 'accepted',
          room_tier: String(guest.room_tier),
          decided_at: new Date(),
          expected_value: revenueOffered * (1 - (guest.p_cancel || 0)),
        });

        booked.push({ ...guest, revenue_at_player_price: revenueOffered });
      } else {
        // Willing to pay but no rooms available
        turnedAway.push({ ...guest, reason: 'no_rooms' });
      }
    } else {
      // Guest's willingness to pay < player's price — priced out
      turnedAway.push({ ...guest, reason: 'priced_out' });
    }
  }

  // 4. Save updated calendar to Redis
  await roomInventoryService.setCalendar(sessionId, userId, calendar);

  // 5. Resolve booked guests (cancellation, no-show)
  const resolvedResults = _resolveBookings(booked);

  // 6. Calculate stats
  const totalRevenue = resolvedResults.reduce((sum, r) => sum + r.revenue_realized, 0);
  const guestsCheckedOut = resolvedResults.filter(r => r.outcome === 'checked_out').length;
  const cancellations = resolvedResults.filter(r => r.outcome === 'cancelled').length;
  const noShows = resolvedResults.filter(r => r.outcome === 'no_show').length;

  // Compute per-tier stats
  const tierStats = {};
  for (const [tierNum, tierName] of Object.entries(TIER_MAP)) {
    const tierBooked = booked.filter(g => TIER_MAP[g.room_tier] === tierName);
    const tierTurnedAway = turnedAway.filter(g => TIER_MAP[g.room_tier] === tierName);
    tierStats[tierName] = {
      price_set: prices[tierName],
      guests_booked: tierBooked.length,
      guests_turned_away: tierTurnedAway.length,
      priced_out: tierTurnedAway.filter(g => g.reason === 'priced_out').length,
      no_rooms: tierTurnedAway.filter(g => g.reason === 'no_rooms').length,
    };
  }

  // Occupancy calculation
  const totalRoomNights = Object.values(HOTEL_INVENTORY[
    (await require('../repositories/sessionRepository').findById(sessionId)).hotel_type
  ] || HOTEL_INVENTORY.city).reduce((sum, n) => sum + n, 0) * 7;
  const roomNightsSold = guestsCheckedOut; // Simplified — each booking = 1 room-night unit

  return {
    week_revenue: parseFloat(totalRevenue.toFixed(2)),
    guests_booked: booked.length,
    guests_turned_away: turnedAway.length,
    guests_checked_out: guestsCheckedOut,
    cancellations,
    no_shows,
    occupancy_rate: parseFloat((Math.max(0, guestsCheckedOut) / Math.max(1, totalRoomNights)).toFixed(4)),
    tier_stats: tierStats,
    calendar,
    prices_submitted: prices,
  };
}

function _checkAvailability(calendar, tierName, arrivalDay, los) {
  const days = calendar[tierName];
  if (!days) return false;
  for (let d = arrivalDay - 1; d < Math.min(arrivalDay - 1 + los, 7); d++) {
    if (days[d] <= 0) return false;
  }
  return true;
}

function _occupyRooms(calendar, tierName, arrivalDay, los) {
  const days = calendar[tierName];
  for (let d = arrivalDay - 1; d < Math.min(arrivalDay - 1 + los, 7); d++) {
    days[d] -= 1;
  }
}

function _resolveBookings(bookedGuests) {
  return bookedGuests.map(guest => {
    const revenue = guest.revenue_at_player_price;
    if (Math.random() < (guest.p_cancel || 0)) {
      return { ...guest, outcome: 'cancelled', revenue_realized: parseFloat((revenue * 0.3).toFixed(2)) };
    }
    if (Math.random() < (guest.p_noshow || 0)) {
      return { ...guest, outcome: 'no_show', revenue_realized: 0 };
    }
    return { ...guest, outcome: 'checked_out', revenue_realized: revenue };
  });
}

module.exports = { simulateWeek };
```
</action>

<acceptance_criteria>
- File `hotel-game/backend/src/services/pricingService.js` exists
- Contains `async function simulateWeek`
- Contains `_checkAvailability`, `_occupyRooms`, `_resolveBookings` helper functions
- `simulateWeek` returns object with keys: `week_revenue`, `guests_booked`, `guests_turned_away`, `tier_stats`, `calendar`
- Guest booking condition: `guest.adr_predicted >= playerPrice`
</acceptance_criteria>

---

## Task 2: Refactor weekOrchestrator.js for pricing flow

<read_first>
- hotel-game/backend/src/game/weekOrchestrator.js (current implementation)
- hotel-game/backend/src/game/guestTimerManager.js (being removed from flow)
</read_first>

<action>
Modify `weekOrchestrator.js`:

1. Remove `guestTimerManager` import and the `setTimeout` guest release call in `_startWeek`
2. In `_startWeek`: after emitting `week:started`, do NOT release guests. Instead, set Redis state with `status: 'awaiting_prices'`
3. Add new function `submitPricesAndSimulate(io, sessionId, userId, prices)`:
   - Validates prices (all 4 tiers present, positive numbers)
   - Calls `pricingService.simulateWeek()`
   - Calls `beginResolution()` with the simulation results
4. In `beginResolution`: adapt to use pricing results instead of per-guest bookings
5. Keep `_computeDemandLevel`, `_endGame`, `advanceWeek` as-is
6. Export `submitPricesAndSimulate` alongside existing exports

Key change in Redis state during `_startWeek`:
```javascript
await redis.set(
  redisKeys.sessionState(session.id),
  JSON.stringify({
    status: 'awaiting_prices',
    currentWeek: weekNumber,
    weekId: week.id,
  }),
  'EX', 7200
);
```

The `week:started` event should also include the room calendar so the frontend can display inventory:
```javascript
const players = await sessionRepository.getPlayers(session.id);
const calendar = await roomInventoryService.getCalendar(session.id, players[0].user_id);

io.to(`session:${session.id}`).emit('week:started', {
  week_number: weekNumber,
  month_name: monthName,
  guest_count: guests.length,
  hotel_type: session.hotel_type,
  demand_level: demandLevel,
  calendar: calendar,
});
```
</action>

<acceptance_criteria>
- `weekOrchestrator.js` does NOT import `guestTimerManager`
- `_startWeek` sets Redis state with `status: 'awaiting_prices'` (not `active`)
- `_startWeek` does NOT call `guestTimerManager.releaseNextGuest`
- `week:started` event includes `calendar` field
- `submitPricesAndSimulate` function exists and is exported
- `module.exports` includes `submitPricesAndSimulate`
</acceptance_criteria>

---

## Task 3: Update gameHandler.js for pricing socket events

<read_first>
- hotel-game/backend/src/socket/handlers/gameHandler.js (current handler)
- hotel-game/backend/src/socket/handlers/decisionHandler.js (being replaced)
</read_first>

<action>
Modify `gameHandler.js`:

1. Add `player:submit_prices` event handler:
```javascript
socket.on('player:submit_prices', async (data) => {
  try {
    const { session_id, prices } = data;
    // prices = { standard: 120, mid: 180, premium: 280, suite: 450 }
    
    if (!prices || !prices.standard || !prices.mid || !prices.premium || !prices.suite) {
      socket.emit('pricing:error', { message: 'All 4 tier prices required' });
      return;
    }

    console.log(`[Socket] Prices submitted for session ${session_id}:`, prices);
    await weekOrchestrator.submitPricesAndSimulate(io, session_id, socket.user.id, prices);
  } catch (err) {
    console.error('[Socket] submit_prices error:', err.message);
    socket.emit('pricing:error', { message: err.message });
  }
});
```

2. Keep `game:start` and `game:advance_week` handlers unchanged.
3. Remove `decisionHandler` registration from `socket/index.js` (it's no longer needed).
</action>

<acceptance_criteria>
- `gameHandler.js` has `socket.on('player:submit_prices', ...)` handler
- Handler validates all 4 tier prices are present
- Handler calls `weekOrchestrator.submitPricesAndSimulate`
- Errors emitted via `pricing:error` event
</acceptance_criteria>

---

## Task 4: Update socket/index.js to remove decisionHandler

<read_first>
- hotel-game/backend/src/socket/index.js
</read_first>

<action>
Remove the `decisionHandler` import and registration. The pricing flow is handled entirely through `gameHandler.js` now.
</action>

<acceptance_criteria>
- `socket/index.js` does NOT require `decisionHandler`
- `socket/index.js` does NOT call `decisionHandler(io, socket)`
</acceptance_criteria>

---

## Verification

After all tasks complete:
1. Backend starts without errors: `npm run dev` from `hotel-game/backend/`
2. Socket event `player:submit_prices` with `{ standard: 100, mid: 150, premium: 250, suite: 400 }` triggers simulation
3. `week:results` event is emitted with `week_revenue`, `tier_stats`, `guests_booked`, `guests_turned_away`
4. Game loop works: `game:start` → `week:started` → `player:submit_prices` → `week:results` → `game:advance_week` → next week
