"""
08_validate_pipeline.py
End-to-end validation: simulates 31 days of January 2020 City Hotel demand
using all trained models, then compares simulated stats against actual data.
"""

import pandas as pd
import numpy as np
import json
import os
from scipy import stats
import onnxruntime as rt

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
INPUT_FILE = os.path.join(DATA_DIR, 'df_featured.csv')

np.random.seed(42)

# ─── Load all model artifacts ─────────────────────────────────────────────────
print("Loading model artifacts...")
with open(os.path.join(MODELS_DIR, 'volume_params.json'), 'r') as f:
    volume_params = json.load(f)
with open(os.path.join(MODELS_DIR, 'profile_params.json'), 'r') as f:
    profile_params = json.load(f)
with open(os.path.join(MODELS_DIR, 'pipeline_config.json'), 'r') as f:
    pipeline_config = json.load(f)
with open(os.path.join(MODELS_DIR, 'upgrade_delta.json'), 'r') as f:
    upgrade_delta = json.load(f)

# Load ONNX sessions
adr_session = rt.InferenceSession(os.path.join(MODELS_DIR, 'adr_model_city.onnx'))
cancel_session = rt.InferenceSession(os.path.join(MODELS_DIR, 'cancel_model.onnx'))
noshow_session = rt.InferenceSession(os.path.join(MODELS_DIR, 'noshow_model.onnx'))

print("  All artifacts loaded successfully")

# Encoding maps
SEGMENT_ENCODE = pipeline_config.get('segment_encode', {
    'Aviation': 0, 'Complementary': 1, 'Corporate': 2, 'Direct': 3,
    'Groups': 4, 'Offline TA/TO': 5, 'Online TA': 6
})
CUSTOMER_TYPE_ENCODE = pipeline_config.get('customer_type_encode', {
    'Transient': 0, 'Transient-Party': 1, 'Contract': 2, 'Group': 3
})

ROOM_TIER_MAP = {'A': 1, 'B': 1, 'C': 2, 'D': 2, 'E': 3, 'F': 3, 'L': 3, 'G': 4, 'H': 4}

# ─── Helper functions ─────────────────────────────────────────────────────────

def sample_neg_binom(mu, alpha):
    """Sample from NegBinom using (mu, alpha) parameterization."""
    if alpha <= 0:
        return max(1, int(np.random.poisson(mu)))
    # Convert (mu, alpha) to scipy (n, p) params
    # alpha = 1/n in statsmodels, so n = 1/alpha
    # p = n / (n + mu)
    n = 1.0 / max(alpha, 1e-6)
    p = n / (n + mu)
    return max(1, int(stats.nbinom.rvs(n, p)))


def sample_categorical(probs_dict):
    """Sample from a categorical distribution given {category: probability}."""
    cats = list(probs_dict.keys())
    probs = np.array([probs_dict[c] for c in cats], dtype=float)
    probs = probs / probs.sum()  # normalize
    return np.random.choice(cats, p=probs)


def sample_lead_time(params):
    """Sample lead time from mixture of 2 exponentials."""
    w = params['w_short']
    if np.random.random() < w:
        return max(0, int(np.random.exponential(params['short_scale'])))
    else:
        return max(0, int(np.random.exponential(params['long_scale'])))


def lead_time_to_bucket(lt):
    """Convert lead time to bucket: 0,1,2,3,4,5."""
    if lt == 0: return 0
    if lt <= 7: return 1
    if lt <= 30: return 2
    if lt <= 90: return 3
    if lt <= 200: return 4
    return 5


def sample_customer(profile_params, hotel_name):
    """Generate a complete customer profile from distribution params."""
    # Room type
    room_type = sample_categorical(profile_params['room_probs'][hotel_name])
    room_tier = ROOM_TIER_MAP.get(room_type, 1)

    # LoS
    los_p = profile_params['los_params'][hotel_name]
    los = max(1, int(stats.nbinom.rvs(los_p['n'], los_p['p'])))
    los = min(los, int(los_p['cap']))

    # Meal plan
    meal = sample_categorical(profile_params['meal_probs'][hotel_name])
    meal_cost = profile_params['meal_cost_lookup'].get(meal, 0.0)

    # Market segment
    segment = sample_categorical(profile_params['segment_probs'][hotel_name])
    segment_discount = profile_params['segment_discount_lookup'].get(segment, 0.0)

    # Total guests
    tier_key = str(room_tier)
    if tier_key in profile_params['guest_probs_by_tier']:
        total_guests = int(sample_categorical(profile_params['guest_probs_by_tier'][tier_key]))
    else:
        total_guests = 2

    # Guest attributes
    attrs = profile_params['guest_attributes'][hotel_name]
    is_repeated = 1 if np.random.random() < attrs['p_repeated_guest'] else 0
    has_special = 1 if np.random.random() < attrs['p_special_request'] else 0
    has_prev_cancel = 1 if np.random.random() < attrs['p_has_prev_cancel'] else 0
    is_non_refund = 1 if np.random.random() < attrs['p_non_refund'] else 0

    # Lead time
    lead_time = sample_lead_time(profile_params['lead_time_params'][hotel_name])
    lead_time_bucket = lead_time_to_bucket(lead_time)

    # Customer type
    customer_type = sample_categorical(profile_params['customer_type_probs'][hotel_name])
    customer_type_enc = CUSTOMER_TYPE_ENCODE.get(customer_type, 0)

    # Market segment encoded
    segment_enc = SEGMENT_ENCODE.get(segment, 0)

    # Deposit type
    deposit_type = sample_categorical(profile_params['deposit_type_probs'][hotel_name])

    # Previous bookings
    prev_cancel_pmf = profile_params.get('previous_cancellations_pmf', {'0': 1.0})
    prev_cancel_count = int(sample_categorical(prev_cancel_pmf))

    prev_not_cancel_pmf = profile_params.get('previous_bookings_not_canceled_pmf', {'0': 1.0})
    loyalty_score = min(int(sample_categorical(prev_not_cancel_pmf)), 20)

    # Booking changes (sample 0-3 with decreasing probability)
    booking_changes = np.random.choice([0, 1, 2, 3], p=[0.7, 0.2, 0.07, 0.03])

    # Days in waiting list (mostly 0)
    days_waiting = 0 if np.random.random() < 0.95 else np.random.geometric(0.3)

    return {
        'room_type': room_type,
        'room_tier': room_tier,
        'los': los,
        'meal': meal,
        'meal_cost': meal_cost,
        'market_segment': segment,
        'segment_discount': segment_discount,
        'segment_enc': segment_enc,
        'total_guests': total_guests,
        'is_repeated_guest': is_repeated,
        'has_special_requests': has_special,
        'has_prev_cancellations': has_prev_cancel,
        'is_non_refund': is_non_refund,
        'lead_time': lead_time,
        'lead_time_bucket': lead_time_bucket,
        'customer_type': customer_type,
        'customer_type_enc': customer_type_enc,
        'deposit_type': deposit_type,
        'loyalty_score': loyalty_score,
        'booking_changes': int(booking_changes),
        'days_in_waiting_list': int(days_waiting),
        'hotel_encoded': 0,  # City Hotel
    }


def predict_adr(profile, session, config):
    """Predict ADR using ONNX model."""
    feature_order = config['adr_feature_order']
    features = []
    for fname in feature_order:
        if fname == 'market_segment_encoded':
            features.append(float(profile['segment_enc']))
        elif fname == 'customer_type_encoded':
            features.append(float(profile['customer_type_enc']))
        elif fname in profile:
            features.append(float(profile[fname]))
        else:
            features.append(0.0)

    arr = np.array([features], dtype=np.float32)
    input_name = session.get_inputs()[0].name
    result = session.run(None, {input_name: arr})
    raw = result[0].flatten()
    adr_hat = float(raw[0])

    # Add Gaussian noise
    noise_std = config['adr_noise_std']['City Hotel']
    adr_final = max(0, adr_hat + np.random.normal(0, noise_std))
    return adr_final


def predict_cancel(profile, session, config):
    """Predict cancellation probability using ONNX model + Platt scaling."""
    feature_order = config['cancel_feature_order']
    features = []
    for fname in feature_order:
        if fname == 'market_segment_encoded':
            features.append(float(profile['segment_enc']))
        elif fname == 'customer_type_encoded':
            features.append(float(profile['customer_type_enc']))
        elif fname in profile:
            features.append(float(profile[fname]))
        else:
            features.append(0.0)

    arr = np.array([features], dtype=np.float32)
    input_name = session.get_inputs()[0].name
    result = session.run(None, {input_name: arr})
    # Output index 1 is probability array; [0][1] is p_cancel (raw)
    try:
        p_raw = float(result[1][0][1])
    except (IndexError, TypeError):
        p_raw = float(result[0][0])

    # Apply Platt scaling calibration: p_cal = 1 / (1 + exp(a * p_raw + b))
    cal = config.get('cancel_calibration', None)
    if cal:
        p_cancel = 1.0 / (1.0 + np.exp(cal['a'] * p_raw + cal['b']))
    else:
        p_cancel = p_raw

    return max(0.0, min(1.0, p_cancel))


# ─── Load actual validation data ──────────────────────────────────────────────
print("\nLoading actual validation data for comparison...")
df = pd.read_csv(INPUT_FILE, parse_dates=['arrival_date'])

int_cols = [
    'is_canceled', 'lead_time', 'arrival_date_year', 'arrival_date_week_number',
    'arrival_date_day_of_month', 'stays_in_weekend_nights', 'stays_in_week_nights',
    'los', 'adults', 'children', 'babies', 'is_repeated_guest',
    'previous_cancellations', 'previous_bookings_not_canceled',
    'booking_changes', 'days_in_waiting_list', 'total_of_special_requests'
]
df[int_cols] = df[int_cols].fillna(0).astype(int)

# January 2020, City Hotel
df_jan_city = df[
    (df['arrival_date'] >= '2020-01-01') &
    (df['arrival_date'] < '2020-02-01') &
    (df['hotel'] == 'City Hotel')
].copy()

print(f"Actual Jan 2020 City Hotel data: {len(df_jan_city)} rows")

# Compute actual statistics
actual_stats = {
    'mean_daily_arrivals': len(df_jan_city) / 31,
    'mean_adr': df_jan_city['adr'].mean(),
    'cancel_rate': df_jan_city['is_canceled'].mean(),
    'room_a_share': (df_jan_city['reserved_room_type'] == 'A').mean(),
    'mean_los': df_jan_city['los'].mean(),
    'non_refund_share': (df_jan_city['deposit_type'] == 'Non Refund').mean()
}

print("\n── Actual Jan 2020 City Hotel Statistics ──")
for k, v in actual_stats.items():
    print(f"  {k}: {v:.4f}")

# ─── Run simulation ───────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print("Running 31-day simulation for City Hotel, January 2020")
print(f"{'='*60}")

hotel_name = 'City Hotel'
month_name = 'January'
month_num = 1

all_customers = []
daily_counts = []

vol_params = volume_params[hotel_name][month_name]
mu = vol_params['mu']
alpha = vol_params['alpha']

for day in range(1, 32):
    # Step 1: Sample daily count (raw — no game clip here; [5,20] clip is a
    # Node.js game-layer decision, not a model validation constraint)
    N = sample_neg_binom(mu, alpha)
    daily_counts.append(N)

    day_customers = []
    for _ in range(N):
        # Step 2: Generate profile
        profile = sample_customer(profile_params, hotel_name)
        profile['month_num'] = month_num
        profile['is_summer'] = 0
        profile['is_weekend_arrival'] = 0  # simplification

        # Step 3: Predict ADR
        adr = predict_adr(profile, adr_session, pipeline_config)
        net_adr = adr * (1 - profile['segment_discount'])
        revenue = net_adr * profile['los'] + profile['meal_cost'] * profile['los']

        # Step 4: Predict cancellation
        p_cancel = predict_cancel(profile, cancel_session, pipeline_config)

        profile['adr'] = adr
        profile['revenue'] = revenue
        profile['p_cancel'] = p_cancel
        day_customers.append(profile)

    all_customers.extend(day_customers)

    if day % 7 == 0 or day == 31:
        print(f"  Day {day:2d}: {N} customers, mean ADR={np.mean([c['adr'] for c in day_customers]):.1f}")

# ─── Compute simulated statistics ─────────────────────────────────────────────
print(f"\n{'='*60}")
print("VALIDATION RESULTS")
print(f"{'='*60}")

sim_stats = {
    'mean_daily_arrivals': np.mean(daily_counts),
    'mean_adr': np.mean([c['adr'] for c in all_customers]),
    'cancel_rate': np.mean([c['p_cancel'] for c in all_customers]),
    'room_a_share': np.mean([1 if c['room_type'] == 'A' else 0 for c in all_customers]),
    'mean_los': np.mean([c['los'] for c in all_customers]),
    'non_refund_share': np.mean([c['is_non_refund'] for c in all_customers])
}

# Acceptance criteria — use ±20% of actual Jan 2020 values
# (The plan's rough estimates assumed ~101/day but actual is 76.1, etc.)
def make_range(actual_val, pct=0.20):
    return (round(actual_val * (1 - pct), 2), round(actual_val * (1 + pct), 2))

criteria = {
    'mean_daily_arrivals': {'actual': f"~{actual_stats['mean_daily_arrivals']:.0f}/day",
                            'range': make_range(actual_stats['mean_daily_arrivals'])},
    'mean_adr':            {'actual': f"~{actual_stats['mean_adr']:.1f}",
                            'range': make_range(actual_stats['mean_adr'])},
    'cancel_rate':         {'actual': f"~{actual_stats['cancel_rate']:.0%}",
                            'range': make_range(actual_stats['cancel_rate'])},
    'room_a_share':        {'actual': f"~{actual_stats['room_a_share']:.0%}",
                            'range': make_range(actual_stats['room_a_share'])},
    'mean_los':            {'actual': f"~{actual_stats['mean_los']:.2f}",
                            'range': make_range(actual_stats['mean_los'])},
    'non_refund_share':    {'actual': f"~{actual_stats['non_refund_share']:.0%}",
                            'range': make_range(actual_stats['non_refund_share'])}
}

all_pass = True
print(f"\n{'Statistic':<25} {'Actual':<12} {'Simulated':<12} {'Range':<16} {'Status'}")
print("-" * 80)

for key in criteria:
    actual_str = criteria[key]['actual']
    lo, hi = criteria[key]['range']
    sim_val = sim_stats[key]

    if key in ['cancel_rate', 'room_a_share', 'non_refund_share']:
        sim_display = f"{sim_val:.1%}"
    else:
        sim_display = f"{sim_val:.1f}"

    if lo <= sim_val <= hi:
        status = "✅ PASS"
    else:
        status = "❌ FAIL"
        all_pass = False

    range_str = f"[{lo}, {hi}]"
    print(f"{key:<25} {actual_str:<12} {sim_display:<12} {range_str:<16} {status}")

print("-" * 80)
if all_pass:
    print("\n✅ ALL ACCEPTANCE CRITERIA PASSED — Pipeline validated successfully!")
else:
    print("\n⚠️  Some criteria failed — review the corresponding sub-model.")
    print("   Common causes: miscalibrated distribution params, ADR noise too high,")
    print("   or incorrect segment discount application.")

# ─── Summary of generated artifacts ───────────────────────────────────────────
print(f"\n{'='*60}")
print("FINAL MODEL ARTIFACTS")
print(f"{'='*60}")

expected_files = [
    'volume_params.json', 'profile_params.json',
    'adr_model_city.onnx', 'adr_model_resort.onnx',
    'cancel_model.onnx', 'noshow_model.onnx',
    'upgrade_delta.json', 'pipeline_config.json'
]

for fname in expected_files:
    fpath = os.path.join(MODELS_DIR, fname)
    exists = os.path.exists(fpath)
    size = os.path.getsize(fpath) if exists else 0
    status = f"✅ {size:>10,} bytes" if exists else "❌ MISSING"
    print(f"  {fname:<30} {status}")

print(f"\n{'='*60}")
print("Pipeline training complete!")
print(f"{'='*60}")
