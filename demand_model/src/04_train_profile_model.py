"""
04_train_profile_model.py
Distribution fitting for customer profiles (2A–2G).
Outputs: models/profile_params.json
"""

import pandas as pd
import numpy as np
import json
import os
from scipy import stats

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
INPUT_FILE = os.path.join(DATA_DIR, 'df_featured.csv')

# Room tier map (for guest distribution by tier)
ROOM_TIER_MAP = {
    'A': 1, 'B': 1,
    'C': 2, 'D': 2,
    'E': 3, 'F': 3, 'L': 3,
    'G': 4, 'H': 4
}

# ─── Load & filter to training set ────────────────────────────────────────────
print("Loading df_featured.csv...")
df = pd.read_csv(INPUT_FILE, parse_dates=['arrival_date'])
df_train = df[df['arrival_date'] < '2020-01-01'].copy()
print(f"Training set: {len(df_train)} rows")

profile_params = {}

# ─── 2A: Room Type Preference Distribution ────────────────────────────────────
print("\n2A — Room Type Preference Distribution")
room_types = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'L']

room_probs = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    hotel_data = df_train[df_train['hotel_encoded'] == hotel_enc]
    total = len(hotel_data)
    probs = {}
    for rt in room_types:
        count = (hotel_data['reserved_room_type'] == rt).sum()
        probs[rt] = round(count / total, 4) if total > 0 else 0.0
    room_probs[hotel_name] = probs
    print(f"  {hotel_name}: {probs}")

profile_params['room_probs'] = room_probs

# ─── 2B: Length of Stay Distribution ──────────────────────────────────────────
print("\n2B — Length of Stay Distribution")
los_params = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    hotel_data = df_train[df_train['hotel_encoded'] == hotel_enc]
    los_vals = hotel_data['los'].values.astype(float)

    # Fit negative binomial using method of moments
    # scipy nbinom uses (n, p) parameterization where mean = n*(1-p)/p, var = n*(1-p)/p^2
    # So: p = mean / var, n = mean * p / (1 - p)  (when var > mean, i.e. overdispersed)
    mu = float(los_vals.mean())
    var = float(los_vals.var())

    if var > mu and mu > 0:
        p = mu / var
        n = mu * p / (1 - p)
    else:
        # Underdispersed or degenerate — use reasonable defaults
        n = 5.0
        p = n / (n + mu) if mu > 0 else 0.5

    # Cap at 99th percentile
    cap = float(np.percentile(los_vals, 99))

    los_params[hotel_name] = {
        'n': round(float(n), 4),
        'p': round(float(p), 4),
        'cap': round(cap, 1)
    }
    print(f"  {hotel_name}: n={n:.4f}, p={p:.4f}, cap={cap:.1f}, mean={mu:.2f}")

profile_params['los_params'] = los_params

# ─── 2C: Meal Plan Distribution ───────────────────────────────────────────────
print("\n2C — Meal Plan Distribution")
meal_types = df_train['meal'].unique().tolist()

meal_probs = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    hotel_data = df_train[df_train['hotel_encoded'] == hotel_enc]
    total = len(hotel_data)
    probs = {}
    for mt in sorted(meal_types):
        count = (hotel_data['meal'] == mt).sum()
        probs[mt] = round(count / total, 4) if total > 0 else 0.0
    meal_probs[hotel_name] = probs
    print(f"  {hotel_name}: {probs}")

profile_params['meal_probs'] = meal_probs

# ─── 2D: Market Segment Distribution ──────────────────────────────────────────
print("\n2D — Market Segment Distribution")
# Exclude 'Undefined' (already dropped in cleaning)
segments = [s for s in df_train['market_segment'].unique() if s != 'Undefined']

segment_probs = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    hotel_data = df_train[df_train['hotel_encoded'] == hotel_enc]
    total = len(hotel_data)
    probs = {}
    for seg in sorted(segments):
        count = (hotel_data['market_segment'] == seg).sum()
        probs[seg] = round(count / total, 4) if total > 0 else 0.0
    segment_probs[hotel_name] = probs
    print(f"  {hotel_name}: {probs}")

profile_params['segment_probs'] = segment_probs

# Also store the segment discount lookup for game use
seg_discount_map = df_train.groupby('market_segment')['segment_discount'].first().to_dict()
profile_params['segment_discount_lookup'] = {k: round(v, 4) for k, v in seg_discount_map.items()}

# ─── 2E: Total Guests Distribution ────────────────────────────────────────────
print("\n2E — Total Guests Distribution (by room tier)")
guest_probs = {}
for tier in sorted(df_train['room_tier'].dropna().unique()):
    tier_data = df_train[df_train['room_tier'] == tier]
    total = len(tier_data)
    guest_vals = tier_data['total_guests'].value_counts().sort_index()
    probs = {}
    for g in range(0, 11):  # 0..10
        probs[str(g)] = round(guest_vals.get(g, 0) / total, 4) if total > 0 else 0.0
    guest_probs[str(int(tier))] = probs

profile_params['guest_probs_by_tier'] = guest_probs
print(f"  Tier keys: {list(guest_probs.keys())}")

# ─── 2F: Guest Attributes (Bernoulli rates) ───────────────────────────────────
print("\n2F — Guest Attributes (Bernoulli rates)")
guest_attrs = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    hotel_data = df_train[df_train['hotel_encoded'] == hotel_enc]
    attrs = {
        'p_repeated_guest': round(float(hotel_data['is_repeated_guest'].mean()), 4),
        'p_special_request': round(float(hotel_data['has_special_requests'].mean()), 4),
        'p_has_prev_cancel': round(float(hotel_data['has_prev_cancellations'].mean()), 4),
        'p_non_refund': round(float(hotel_data['is_non_refund'].mean()), 4)
    }
    guest_attrs[hotel_name] = attrs
    print(f"  {hotel_name}: {attrs}")

profile_params['guest_attributes'] = guest_attrs

# ─── 2G: Lead Time Distribution ───────────────────────────────────────────────
print("\n2G — Lead Time Distribution (mixture of 2 exponentials)")
lead_time_params = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    hotel_data = df_train[df_train['hotel_encoded'] == hotel_enc]
    lt = hotel_data['lead_time'].values.astype(float)

    # Short-lead component: lead_time <= 30
    short = lt[lt <= 30]
    # Long-lead component: lead_time > 30
    long = lt[lt > 30]

    w = len(short) / len(lt)  # mixing weight

    # Fit exponential: scipy.stats.expon.fit returns (loc, scale)
    # For short-lead, loc=0, scale=mean
    short_scale = float(short.mean()) if len(short) > 0 else 10.0
    long_scale = float(long.mean()) if len(long) > 0 else 100.0

    lead_time_params[hotel_name] = {
        'w_short': round(w, 4),
        'short_scale': round(short_scale, 2),
        'long_scale': round(long_scale, 2)
    }
    print(f"  {hotel_name}: w_short={w:.4f}, short_scale={short_scale:.1f}, long_scale={long_scale:.1f}")

profile_params['lead_time_params'] = lead_time_params

# ─── Also store meal cost lookup ───────────────────────────────────────────────
meal_cost_map = df_train.groupby('meal')['meal_cost_per_night'].first().to_dict()
profile_params['meal_cost_lookup'] = {k: round(v, 2) for k, v in meal_cost_map.items()}

# ─── Store customer_type distribution ──────────────────────────────────────────
print("\nBonus — Customer Type Distribution")
ct_probs = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    hotel_data = df_train[df_train['hotel_encoded'] == hotel_enc]
    total = len(hotel_data)
    probs = {}
    for ct in sorted(hotel_data['customer_type'].unique()):
        count = (hotel_data['customer_type'] == ct).sum()
        probs[ct] = round(count / total, 4)
    ct_probs[hotel_name] = probs
    print(f"  {hotel_name}: {probs}")

profile_params['customer_type_probs'] = ct_probs

# ─── Store deposit_type distribution ───────────────────────────────────────────
print("\nBonus — Deposit Type Distribution")
dt_probs = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    hotel_data = df_train[df_train['hotel_encoded'] == hotel_enc]
    total = len(hotel_data)
    probs = {}
    for dt in sorted(hotel_data['deposit_type'].unique()):
        count = (hotel_data['deposit_type'] == dt).sum()
        probs[dt] = round(count / total, 4)
    dt_probs[hotel_name] = probs
    print(f"  {hotel_name}: {probs}")

profile_params['deposit_type_probs'] = dt_probs

# ─── Store distribution_channel distribution ───────────────────────────────────
dist_ch_probs = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    hotel_data = df_train[df_train['hotel_encoded'] == hotel_enc]
    total = len(hotel_data)
    probs = {}
    for dc in sorted(hotel_data['distribution_channel'].unique()):
        count = (hotel_data['distribution_channel'] == dc).sum()
        probs[dc] = round(count / total, 4)
    dist_ch_probs[hotel_name] = probs

profile_params['distribution_channel_probs'] = dist_ch_probs

# ─── Store previous_cancellations and previous_bookings_not_canceled PMFs ──────
# (per plan item 3 in Known Data Limitations — sample from empirical distribution)
print("\nBonus — Historical booking counts PMFs (for sampling at inference)")
for col_name in ['previous_cancellations', 'previous_bookings_not_canceled']:
    pmf = {}
    vals = df_train[col_name].value_counts(normalize=True).sort_index()
    for v, p in vals.items():
        pmf[str(int(v))] = round(float(p), 6)
    profile_params[f'{col_name}_pmf'] = pmf

# ─── Save ──────────────────────────────────────────────────────────────────────
output_path = os.path.join(MODELS_DIR, 'profile_params.json')
with open(output_path, 'w') as f:
    json.dump(profile_params, f, indent=2)

print(f"\n✅ Saved profile_params.json to {output_path}")
print(f"   Keys: {list(profile_params.keys())}")
