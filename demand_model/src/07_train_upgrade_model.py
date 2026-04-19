"""
07_train_upgrade_model.py
Computes room upgrade/downgrade ADR deltas as a lookup table.
Outputs: models/upgrade_delta.json
"""

import pandas as pd
import numpy as np
import json
import os

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
INPUT_FILE = os.path.join(DATA_DIR, 'df_featured.csv')

# Room tier map
ROOM_TIER_MAP = {
    'A': 1, 'B': 1,
    'C': 2, 'D': 2,
    'E': 3, 'F': 3, 'L': 3,
    'G': 4, 'H': 4
}

# ─── Load data ─────────────────────────────────────────────────────────────────
print("Loading df_featured.csv...")
df = pd.read_csv(INPUT_FILE, parse_dates=['arrival_date'])

int_cols = [
    'is_canceled', 'lead_time', 'arrival_date_year', 'arrival_date_week_number',
    'arrival_date_day_of_month', 'stays_in_weekend_nights', 'stays_in_week_nights',
    'los', 'adults', 'children', 'babies', 'is_repeated_guest',
    'previous_cancellations', 'previous_bookings_not_canceled',
    'booking_changes', 'days_in_waiting_list', 'total_of_special_requests'
]
df[int_cols] = df[int_cols].fillna(0).astype(int)

# Training set only
df_train = df[df['arrival_date'] < '2020-01-01'].copy()
print(f"Training set: {len(df_train)} rows")

# ─── Compute mean ADR per hotel × room_type ───────────────────────────────────
# Using the simpler approach from the plan: mean ADR per hotel × room_type
print("\nComputing mean ADR per hotel × room type...")

# Filter to Check-Out rows for more reliable ADR values
df_checkout = df_train[df_train['reservation_status'] == 'Check-Out'].copy()
print(f"Check-Out rows in training: {len(df_checkout)}")

# Add tier columns
df_checkout['reserved_tier'] = df_checkout['reserved_room_type'].map(ROOM_TIER_MAP)
df_checkout['assigned_tier'] = df_checkout['assigned_room_type'].map(ROOM_TIER_MAP)

# Compute mean ADR per hotel × room_tier (using reserved_room_type for base pricing)
mean_adr_by_tier = (
    df_checkout
    .groupby(['hotel', 'reserved_tier'])['adr']
    .mean()
    .reset_index()
)
print("\nMean ADR by hotel × tier:")
for _, row in mean_adr_by_tier.iterrows():
    print(f"  {row['hotel']}, Tier {int(row['reserved_tier'])}: {row['adr']:.2f}")

# ─── Build upgrade_delta lookup ───────────────────────────────────────────────
print("\nBuilding upgrade_delta lookup table...")

upgrade_delta = {}
for hotel_name in ['City Hotel', 'Resort Hotel']:
    hotel_adr = mean_adr_by_tier[mean_adr_by_tier['hotel'] == hotel_name]

    # Get available tiers for this hotel
    tier_adr = {}
    for _, row in hotel_adr.iterrows():
        tier_adr[int(row['reserved_tier'])] = row['adr']

    hotel_deltas = {}
    available_tiers = sorted(tier_adr.keys())

    for from_tier in available_tiers:
        tier_deltas = {}
        for to_tier in available_tiers:
            if from_tier != to_tier:
                delta = tier_adr[to_tier] - tier_adr[from_tier]
                tier_deltas[str(to_tier)] = round(float(delta), 2)
        hotel_deltas[str(from_tier)] = tier_deltas

    upgrade_delta[hotel_name] = hotel_deltas

    # Print the deltas
    print(f"\n  {hotel_name}:")
    for from_t in available_tiers:
        for to_t in available_tiers:
            if from_t != to_t:
                d = tier_adr[to_t] - tier_adr[from_t]
                direction = "upgrade" if d > 0 else "downgrade"
                print(f"    Tier {from_t} → {to_t}: {d:+.2f} ({direction})")

# ─── Also compute some upgrade statistics ─────────────────────────────────────
print("\n── Upgrade Statistics ──")
upgraded = df_checkout[df_checkout['room_was_upgraded'] == 1]
total = len(df_checkout)
print(f"Upgraded bookings: {len(upgraded)} / {total} ({100*len(upgraded)/total:.1f}%)")

for hotel_name in ['City Hotel', 'Resort Hotel']:
    hotel_up = upgraded[upgraded['hotel'] == hotel_name]
    if len(hotel_up) > 0:
        print(f"\n  {hotel_name} upgrades: {len(hotel_up)}")
        print(f"    Mean upgrade_delta_tier: {hotel_up['upgrade_delta_tier'].mean():.2f}")
        print(f"    Positive (actual upgrade): {(hotel_up['upgrade_delta_tier'] > 0).sum()}")
        print(f"    Negative (downgrade): {(hotel_up['upgrade_delta_tier'] < 0).sum()}")
        print(f"    Zero (same tier, diff room): {(hotel_up['upgrade_delta_tier'] == 0).sum()}")

# ─── Save ──────────────────────────────────────────────────────────────────────
output_path = os.path.join(MODELS_DIR, 'upgrade_delta.json')
with open(output_path, 'w') as f:
    json.dump(upgrade_delta, f, indent=2)

print(f"\n✅ Saved upgrade_delta.json to {output_path}")
