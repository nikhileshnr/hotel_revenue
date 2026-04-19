"""
02_feature_engineering.py
Loads data/df_clean.csv, engineers temporal / room / commercial / behavioral
features, outputs data/df_featured.csv.
"""

import pandas as pd
import numpy as np
import os

# Paths
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
INPUT_FILE = os.path.join(DATA_DIR, 'df_clean.csv')
OUTPUT_FILE = os.path.join(DATA_DIR, 'df_featured.csv')

# ─── Load cleaned data ────────────────────────────────────────────────────────
print("Loading df_clean.csv...")
df = pd.read_csv(INPUT_FILE, parse_dates=['arrival_date'])

# Enforce integer types on columns that CSV may have loaded as float
int_cols = [
    'is_canceled', 'lead_time', 'arrival_date_year', 'arrival_date_week_number',
    'arrival_date_day_of_month', 'stays_in_weekend_nights', 'stays_in_week_nights',
    'los', 'adults', 'children', 'babies', 'is_repeated_guest',
    'previous_cancellations', 'previous_bookings_not_canceled',
    'booking_changes', 'days_in_waiting_list', 'total_of_special_requests'
]
df[int_cols] = df[int_cols].fillna(0).astype(int)
print(f"Loaded {len(df)} rows × {len(df.columns)} columns")

# ─── 2.1 Temporal Features ────────────────────────────────────────────────────
print("\nEngineering temporal features...")

# month_num: map month name to int
month_map = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
}
df['month_num'] = df['arrival_date_month'].map(month_map)

# is_summer: 1 if month_num in {6, 7, 8}
df['is_summer'] = df['month_num'].isin([6, 7, 8]).astype(int)

# is_winter: 1 if month_num in {11, 12, 1, 2}
df['is_winter'] = df['month_num'].isin([11, 12, 1, 2]).astype(int)

# is_weekend_arrival: 1 if arrival_date.weekday() in {5, 6}
df['is_weekend_arrival'] = df['arrival_date'].dt.weekday.isin([5, 6]).astype(int)

# total_guests: adults + children + babies (clip at max 10)
df['total_guests'] = (df['adults'] + df['children'] + df['babies']).clip(upper=10)

# lead_time_bucket: 0 if 0, 1 if 1-7, 2 if 8-30, 3 if 31-90, 4 if 91-200, 5 if 200+
df['lead_time_bucket'] = pd.cut(
    df['lead_time'],
    bins=[-1, 0, 7, 30, 90, 200, float('inf')],
    labels=[0, 1, 2, 3, 4, 5]
).astype(int)

print(f"  Added: month_num, is_summer, is_winter, is_weekend_arrival, total_guests, lead_time_bucket")

# ─── 2.2 Hotel / Room Features ────────────────────────────────────────────────
print("Engineering hotel/room features...")

# hotel_encoded: City Hotel=0, Resort Hotel=1
df['hotel_encoded'] = (df['hotel'] == 'Resort Hotel').astype(int)

# room_tier map based on mean ADR from EDA
room_tier_map = {
    'A': 1, 'B': 1,  # Standard
    'C': 2, 'D': 2,  # Mid
    'E': 3, 'F': 3, 'L': 3,  # Premium
    'G': 4, 'H': 4   # Suite
}

# room_tier using reserved_room_type
df['room_tier'] = df['reserved_room_type'].map(room_tier_map)
# Also compute assigned_room_tier for upgrade delta
df['assigned_room_tier'] = df['assigned_room_type'].map(room_tier_map)

# room_was_upgraded: 1 if assigned_room_type != reserved_room_type
df['room_was_upgraded'] = (df['assigned_room_type'] != df['reserved_room_type']).astype(int)

# upgrade_delta_tier: assigned_tier - reserved_tier
df['upgrade_delta_tier'] = df['assigned_room_tier'] - df['room_tier']

print(f"  Added: hotel_encoded, room_tier, assigned_room_tier, room_was_upgraded, upgrade_delta_tier")

# ─── 2.3 Commercial / Behavioral Features ─────────────────────────────────────
print("Engineering commercial/behavioral features...")

# net_adr: adr * (1 - segment_discount)
df['net_adr'] = df['adr'] * (1 - df['segment_discount'])

# total_revenue: net_adr * los + meal_cost_per_night * los
df['total_revenue'] = df['net_adr'] * df['los'] + df['meal_cost_per_night'] * df['los']

# has_special_requests: 1 if total_of_special_requests > 0
df['has_special_requests'] = (df['total_of_special_requests'] > 0).astype(int)

# has_prev_cancellations: 1 if previous_cancellations > 0
df['has_prev_cancellations'] = (df['previous_cancellations'] > 0).astype(int)

# loyalty_score: previous_bookings_not_canceled (clip at 20)
df['loyalty_score'] = df['previous_bookings_not_canceled'].clip(upper=20)

# is_no_deposit: 1 if deposit_type == 'No Deposit'
df['is_no_deposit'] = (df['deposit_type'] == 'No Deposit').astype(int)

# is_non_refund: 1 if deposit_type == 'Non Refund'
df['is_non_refund'] = (df['deposit_type'] == 'Non Refund').astype(int)

# target_cancel: same as is_canceled (alias)
df['target_cancel'] = df['is_canceled']

# target_noshow: 1 if reservation_status == 'No-Show'
df['target_noshow'] = (df['reservation_status'] == 'No-Show').astype(int)

print(f"  Added: net_adr, total_revenue, has_special_requests, has_prev_cancellations,")
print(f"         loyalty_score, is_no_deposit, is_non_refund, target_cancel, target_noshow")

# ─── Save ──────────────────────────────────────────────────────────────────────
df.to_csv(OUTPUT_FILE, index=False)
print(f"\n✅ Saved featured dataframe to {OUTPUT_FILE}")
print(f"   Final shape: {df.shape[0]} rows × {df.shape[1]} columns")
