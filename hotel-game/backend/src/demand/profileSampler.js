const { getVolumeParams, getProfileParams, getConfig } = require('./modelLoader');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const HOTEL_KEY = { city: 'City Hotel', resort: 'Resort Hotel' };

const ROOM_TO_TIER = {
  A: 1, B: 1, C: 2, D: 2, E: 3, F: 3, L: 3, G: 4, H: 4,
};

const LEAD_TIME_BUCKETS = [
  { max: 0, value: 0 },
  { max: 7, value: 1 },
  { max: 30, value: 2 },
  { max: 90, value: 3 },
  { max: 200, value: 4 },
  { max: Infinity, value: 5 },
];

// --- Sampling utilities ---

/** Sample from categorical distribution { key: prob } */
function sampleCategorical(probMap) {
  const entries = Object.entries(probMap);
  const r = Math.random();
  let cumulative = 0;
  for (const [key, prob] of entries) {
    cumulative += prob;
    if (r < cumulative) return key;
  }
  return entries[entries.length - 1][0]; // fallback
}

/** Sample from empirical PMF { value: prob } — returns the numeric value */
function samplePMF(pmf) {
  const keys = Object.keys(pmf);
  const r = Math.random();
  let cumulative = 0;
  for (const k of keys) {
    cumulative += pmf[k];
    if (r < cumulative) return parseInt(k, 10);
  }
  return parseInt(keys[keys.length - 1], 10);
}

/** Sample from Negative Binomial using Gamma-Poisson mixture */
function sampleNegBinom(mu, alpha) {
  // NB(mu, alpha): mean=mu, variance=mu + alpha*mu^2
  // Sample gamma shape=1/alpha, scale=alpha*mu, then Poisson(gamma)
  if (alpha <= 0) return Math.round(mu);

  const shape = 1 / alpha;
  const scale = alpha * mu;

  // Gamma sampling via Marsaglia-Tsang
  const gammaVal = sampleGamma(shape, scale);
  // Poisson with rate = gammaVal
  return samplePoisson(gammaVal);
}

/** Gamma distribution sampling (Marsaglia & Tsang transform) */
function sampleGamma(shape, scale) {
  if (shape < 1) {
    return sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x, v;
    do {
      x = randn();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v * scale;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

/** Poisson sampling (Knuth's method for small lambda, rejection for large) */
function samplePoisson(lambda) {
  if (lambda <= 0) return 0;
  if (lambda < 30) {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }
  // For large lambda, use normal approximation
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * randn()));
}

/** Standard normal using Box-Muller */
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Exponential sampling */
function sampleExponential(scale) {
  return -scale * Math.log(1 - Math.random());
}

// --- Public functions ---

function sampleGuestCount(hotelType, monthNum) {
  const volumeParams = getVolumeParams();
  const hotelKey = HOTEL_KEY[hotelType];
  const monthName = MONTH_NAMES[monthNum - 1];

  const params = volumeParams[hotelKey][monthName];
  if (!params) {
    throw new Error(`No volume params for ${hotelKey} / ${monthName}`);
  }

  // mu represents average daily arrivals — use directly as the week's guest pool
  let count = sampleNegBinom(params.mu, params.alpha);
  count = Math.max(1, count); // At least 1 guest
  return count;
}

function sampleProfile(hotelType) {
  const profileParams = getProfileParams();
  const config = getConfig();
  const hotelKey = HOTEL_KEY[hotelType];

  // 1. Room type → room_tier
  const roomType = sampleCategorical(profileParams.room_probs[hotelKey]);
  const room_tier = ROOM_TO_TIER[roomType] || 1;

  // 2. Length of Stay (Negative Binomial, capped)
  const losP = profileParams.los_params[hotelKey];
  let los = sampleNegBinomNP(losP.n, losP.p);
  los = Math.max(1, Math.min(Math.floor(losP.cap), los));

  // 3. Meal plan
  const meal = sampleCategorical(profileParams.meal_probs[hotelKey]);
  const meal_cost = profileParams.meal_cost_lookup[meal] || 0;

  // 4. Market segment
  const market_segment = sampleCategorical(profileParams.segment_probs[hotelKey]);
  const segment_discount = profileParams.segment_discount_lookup[market_segment] || 0;
  const market_segment_encoded = config.segment_encode[market_segment] || 0;

  // Conditional LOS adjustment based on tier + segment
  let losMultiplier = 1.0;
  if (room_tier === 4) losMultiplier *= 1.3;       // Suite guests stay longer
  if (market_segment === 'Corporate') losMultiplier *= 0.7;  // Short business trips
  if (market_segment === 'Groups') losMultiplier *= 1.4;     // Group bookings stay longer
  if (losMultiplier !== 1.0) {
    los = Math.max(1, Math.min(Math.floor(losP.cap), Math.round(los * losMultiplier)));
  }

  // 5. Customer type
  const customer_type = sampleCategorical(profileParams.customer_type_probs[hotelKey]);
  const customer_type_encoded = config.customer_type_encode[customer_type] || 0;

  // 6. Total guests (per room tier)
  const tierStr = String(room_tier);
  const total_guests = samplePMF(profileParams.guest_probs_by_tier[tierStr]);

  // 7. Guest attributes (Bernoulli)
  const attrs = profileParams.guest_attributes[hotelKey];
  const is_repeated_guest = Math.random() < attrs.p_repeated_guest ? 1 : 0;
  const has_special_requests = Math.random() < attrs.p_special_request ? 1 : 0;
  const has_prev_cancellations = Math.random() < attrs.p_has_prev_cancel ? 1 : 0;
  const is_non_refund = Math.random() < attrs.p_non_refund ? 1 : 0;

  // 8. Deposit type from is_non_refund (and deposit_type_probs)
  let deposit_type;
  if (is_non_refund) {
    deposit_type = 'Non Refund';
  } else {
    // Sample between No Deposit and Refundable
    deposit_type = Math.random() < 0.99 ? 'No Deposit' : 'Refundable';
  }

  // 9. Lead time (exponential mixture)
  const ltP = profileParams.lead_time_params[hotelKey];
  let lead_time;
  if (Math.random() < ltP.w_short) {
    lead_time = Math.round(sampleExponential(ltP.short_scale));
  } else {
    lead_time = Math.round(sampleExponential(ltP.long_scale));
  }
  lead_time = Math.max(0, lead_time);

  // Lead time bucket
  let lead_time_bucket = 5;
  for (const bucket of LEAD_TIME_BUCKETS) {
    if (lead_time <= bucket.max) {
      lead_time_bucket = bucket.value;
      break;
    }
  }

  // 10. Previous cancellations & bookings (from PMF)
  const previous_cancellations = has_prev_cancellations
    ? samplePMF(profileParams.previous_cancellations_pmf)
    : 0;
  const previous_bookings_not_canceled = samplePMF(
    profileParams.previous_bookings_not_canceled_pmf
  );
  const loyalty_score = Math.min(20, previous_bookings_not_canceled);

  // 11. Derived features for ML inference
  const hotel_encoded = hotelType === 'city' ? 0 : 1;
  const month_num = 0; // Will be set by guestFactory when it knows the month
  const is_summer = 0; // Will be set by guestFactory
  const is_weekend_arrival = Math.random() < 2 / 7 ? 1 : 0; // ~28.6% weekend arrival

  return {
    room_type: roomType,
    room_tier,
    los,
    meal,
    meal_cost,
    market_segment,
    segment_discount,
    market_segment_encoded,
    customer_type,
    customer_type_encoded,
    total_guests: Math.max(1, total_guests),
    is_repeated_guest,
    has_special_requests,
    has_prev_cancellations,
    is_non_refund,
    deposit_type,
    lead_time,
    lead_time_bucket,
    previous_cancellations,
    loyalty_score,
    hotel_encoded,
    month_num,
    is_summer,
    is_weekend_arrival,
    booking_changes: 0,
    days_in_waiting_list: 0,
  };
}

/** Negative Binomial with (n, p) parameterization */
function sampleNegBinomNP(n, p) {
  // NB(n, p) = number of failures before n successes
  // Mean = n(1-p)/p, Var = n(1-p)/p^2
  // Use Gamma-Poisson: Gamma(n, (1-p)/p) then Poisson
  const scale = (1 - p) / p;
  const gammaVal = sampleGamma(n, scale);
  return samplePoisson(gammaVal);
}

module.exports = {
  sampleGuestCount,
  sampleProfile,
  HOTEL_KEY,
  MONTH_NAMES,
  randn,
};
