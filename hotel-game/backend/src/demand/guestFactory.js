const { sampleGuestCount, sampleProfile, MONTH_NAMES } = require('./profileSampler');
const { predictRevenue } = require('./adrPredictor');
const { predictRisk } = require('./riskPredictor');

const HOTEL_KEY = { city: 'City Hotel', resort: 'Resort Hotel' };

// Strategic segment labels for educational context
const SEGMENT_LABELS = {
  'Direct': 'High Margin',
  'Corporate': 'Reliable',
  'Online TA': 'High Volume',
  'Offline TA/TO': 'High Volume',
  'Groups': 'High Risk',
  'Aviation': 'Discounted',
  'Complementary': 'No Revenue',
};

const PROFILE_SERVICE_URL = process.env.PROFILE_SERVICE_URL || 'http://localhost:8000';
const PROFILE_SERVICE_TIMEOUT_MS = parseInt(process.env.PROFILE_SERVICE_TIMEOUT_MS || '30000', 10);

/**
 * Generate guests via CTGAN Python service (primary) or statistical fallback.
 */
async function generateWeekGuests(hotelType, monthNum) {
  const N = sampleGuestCount(hotelType, monthNum);

  // ─── Primary path: CTGAN + Python inference ───────────────────────────
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROFILE_SERVICE_TIMEOUT_MS);

    const response = await fetch(`${PROFILE_SERVICE_URL}/generate-guests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotel_type: hotelType, month_num: monthNum, n: N }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      console.log(`[guestFactory] Generated ${data.count} guests via CTGAN+Python (source: ${data.source})`);
      return data.guests;
    }

    console.warn(`[guestFactory] Profile service returned ${response.status}, falling back to statistical`);
  } catch (err) {
    console.warn(`[guestFactory] WARNING: Profile service unavailable (${err.message}), using statistical fallback`);
  }

  // ─── Fallback path: statistical sampling + ONNX inference ─────────────
  console.log(`[guestFactory] Generating ${N} guests via statistical fallback`);
  const isSummer = [6, 7, 8].includes(monthNum) ? 1 : 0;
  const guests = [];

  for (let i = 0; i < N; i++) {
    const profile = sampleProfile(hotelType);

    // Set month-dependent features
    profile.month_num = monthNum;
    profile.is_summer = isSummer;

    // Predict ADR and revenue
    const { adr_predicted, revenue_offered } = await predictRevenue(hotelType, profile);

    // Predict cancellation and no-show risk
    const { p_cancel, p_noshow, risk_badge } = await predictRisk(profile);

    // Compute expected value (risk-adjusted revenue)
    const expected_value = parseFloat((revenue_offered * (1 - p_cancel)).toFixed(2));

    // Assign arrival day (1–7)
    const arrival_day = Math.floor(Math.random() * 7) + 1;

    // Map segment to strategic label
    const segment_label = SEGMENT_LABELS[profile.market_segment] || profile.market_segment;

    guests.push({
      index: i,
      room_type: profile.room_type,
      room_tier: profile.room_tier,
      los: profile.los,
      arrival_day,
      meal: profile.meal,
      market_segment: profile.market_segment,
      segment_label,
      segment_discount: profile.segment_discount,
      meal_cost: profile.meal_cost,
      total_guests: profile.total_guests,
      is_repeated_guest: profile.is_repeated_guest,
      has_special_requests: profile.has_special_requests,
      is_non_refund: profile.is_non_refund,
      deposit_type: profile.deposit_type,
      lead_time_bucket: profile.lead_time_bucket,
      adr_predicted,
      revenue_offered,
      p_cancel,
      p_noshow,
      risk_badge,
      expected_value,
    });
  }

  return guests;
}

module.exports = { generateWeekGuests };
