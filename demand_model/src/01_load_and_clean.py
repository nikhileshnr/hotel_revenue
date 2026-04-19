"""
01_load_and_clean.py
Loads hotel_revenue_historical_full.xlsx (3 year sheets: 2018–2020)
+ hotel_booking.csv (3 years: 2015–2017, PII columns dropped),
applies the 9-step cleaning pipeline, outputs data/df_clean.csv.
"""

import pandas as pd
import numpy as np
import os

# Paths (relative to demand_model/)
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
SOURCE_FILE = os.path.join(DATA_DIR, 'hotel_revenue_historical_full.xlsx')
NEW_CSV_FILE = os.path.join(DATA_DIR, 'hotel_booking.csv')
OUTPUT_FILE = os.path.join(DATA_DIR, 'df_clean.csv')

# ─── 1.1 Load All Sheets ──────────────────────────────────────────────────────
print("Loading Excel sheets (2018–2020)...")
df_2018 = pd.read_excel(SOURCE_FILE, sheet_name='2018')
df_2019 = pd.read_excel(SOURCE_FILE, sheet_name='2019')
df_2020 = pd.read_excel(SOURCE_FILE, sheet_name='2020')
df_meal = pd.read_excel(SOURCE_FILE, sheet_name='meal_cost')
df_seg  = pd.read_excel(SOURCE_FILE, sheet_name='market_segment')

# Stack 2018-2020 year sheets
df_old = pd.concat([df_2018, df_2019, df_2020], ignore_index=True)
print(f"2018-2020 rows: {len(df_old)}")

# ─── 1.1b Load New 2015–2017 CSV ──────────────────────────────────────────────
print("\nLoading new CSV (2015–2017)...")
df_new = pd.read_csv(NEW_CSV_FILE)
df_new = df_new.drop(columns=['name', 'email', 'phone-number', 'credit_card'])
print(f"2015-2017 rows: {len(df_new)}")

# Stack them together (new data first, then old)
df = pd.concat([df_new, df_old], ignore_index=True)
print(f"Total combined: {len(df)}")
print(f"Columns match: {df_new.columns.tolist() == df_old.columns.tolist()}")

print(f"\nLoaded {len(df)} rows x {len(df.columns)} columns from 6 years (2015–2020)")
print(f"Meal cost lookup: {len(df_meal)} rows")
print(f"Market segment lookup: {len(df_seg)} rows")

# ─── 1.2 Date Construction ────────────────────────────────────────────────────
print("\nConstructing arrival_date...")
df['arrival_date_str'] = (
    df['arrival_date_year'].astype(str) + '-' +
    df['arrival_date_month'].astype(str) + '-' +
    df['arrival_date_day_of_month'].astype(str)
)
df['arrival_date'] = pd.to_datetime(df['arrival_date_str'], format='%Y-%B-%d', errors='coerce')

# Drop rows where date parse failed
n_before = len(df)
df = df.dropna(subset=['arrival_date'])
n_dropped = n_before - len(df)
if n_dropped > 0:
    print(f"  Dropped {n_dropped} rows with unparseable dates")
else:
    print("  All dates parsed successfully")

df = df.drop(columns=['arrival_date_str'])

# ─── 1.3 Data Cleaning — 9 Steps ──────────────────────────────────────────────

# Step 1 — Drop Room Type P entirely
n_before = len(df)
df = df[
    (df['reserved_room_type'] != 'P') &
    (df['assigned_room_type'] != 'P')
]
print(f"Step 1 — Drop room type P: {n_before - len(df)} rows removed ({len(df)} remaining)")

# Step 2 — Drop zero-night stays
df['los'] = df['stays_in_weekend_nights'] + df['stays_in_week_nights']
n_before = len(df)
df = df[df['los'] > 0]
print(f"Step 2 — Drop zero-night stays: {n_before - len(df)} rows removed ({len(df)} remaining)")

# Step 3 — Drop negative ADR
n_before = len(df)
df = df[df['adr'] >= 0]
print(f"Step 3 — Drop negative ADR: {n_before - len(df)} rows removed ({len(df)} remaining)")

# Step 4 — Cap ADR outliers per hotel
# Cap at 99.5th percentile within each hotel group
# Plan specifies: Resort Hotel cap at 299.0, City Hotel cap at 240.8
adr_caps = {'Resort Hotel': 299.0, 'City Hotel': 240.8}
for hotel, cap in adr_caps.items():
    mask = df['hotel'] == hotel
    n_capped = (df.loc[mask, 'adr'] > cap).sum()
    df.loc[mask, 'adr'] = df.loc[mask, 'adr'].clip(upper=cap)
    print(f"Step 4 — Cap ADR for {hotel} at {cap}: {n_capped} values capped")

# Step 5 — Cap LoS outliers at 99th percentile per hotel
for hotel in df['hotel'].unique():
    mask = df['hotel'] == hotel
    p99 = df.loc[mask, 'los'].quantile(0.99)
    n_capped = (df.loc[mask, 'los'] > p99).sum()
    df.loc[mask, 'los'] = df.loc[mask, 'los'].clip(upper=p99)
    print(f"Step 5 — Cap LoS for {hotel} at {p99}: {n_capped} values capped")

# Step 6 — Exclude COVID disruption period (arrival_date >= 2020-03-01)
n_before = len(df)
df = df[df['arrival_date'] < '2020-03-01']
print(f"Step 6 — Exclude COVID period (>= 2020-03-01): {n_before - len(df)} rows removed ({len(df)} remaining)")

# Step 7 — Drop market_segment == 'Undefined'
n_before = len(df)
df = df[df['market_segment'] != 'Undefined']
print(f"Step 7 — Drop undefined market segment: {n_before - len(df)} rows removed ({len(df)} remaining)")

# Step 8 — Merge lookup tables
df = df.merge(df_meal, on='meal', how='left')
df = df.rename(columns={'Cost': 'meal_cost_per_night'})
df = df.merge(df_seg, on='market_segment', how='left')
df = df.rename(columns={'Discount': 'segment_discount'})
df['meal_cost_per_night'] = df['meal_cost_per_night'].fillna(0)
df['segment_discount'] = df['segment_discount'].fillna(0)
print(f"Step 8 — Merged lookup tables (meal_cost_per_night, segment_discount)")

# Step 9 — Final columns to keep
final_columns = [
    'arrival_date', 'hotel', 'is_canceled', 'lead_time', 'arrival_date_year',
    'arrival_date_month', 'arrival_date_week_number', 'arrival_date_day_of_month',
    'stays_in_weekend_nights', 'stays_in_week_nights', 'los', 'adults', 'children',
    'babies', 'meal', 'country', 'market_segment', 'distribution_channel',
    'is_repeated_guest', 'previous_cancellations', 'previous_bookings_not_canceled',
    'reserved_room_type', 'assigned_room_type', 'booking_changes', 'deposit_type',
    'agent', 'days_in_waiting_list', 'customer_type', 'adr', 'total_of_special_requests',
    'reservation_status', 'meal_cost_per_night', 'segment_discount'
]
df = df[final_columns]
print(f"Step 9 — Retained {len(final_columns)} columns")

# ─── Save ──────────────────────────────────────────────────────────────────────
df.to_csv(OUTPUT_FILE, index=False)
print(f"\n✅ Saved cleaned dataframe to {OUTPUT_FILE}")
print(f"   Final shape: {df.shape[0]} rows × {df.shape[1]} columns")
print(f"   Expected: ~118,000–122,000 rows")
