"""
09_train_ctgan.py
Trains a CTGANSynthesizer on guest profile features from df_featured.csv.
Outputs: models/ctgan_model.pkl, models/ctgan_metadata.json
"""

import pandas as pd
import numpy as np
import json
import os
from datetime import date

from sdv.metadata import SingleTableMetadata
from sdv.single_table import CTGANSynthesizer

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
INPUT_FILE = os.path.join(DATA_DIR, 'df_featured.csv')

# ─── Column definitions ───────────────────────────────────────────────────────
PROFILE_COLUMNS = [
    'hotel_encoded', 'month_num', 'room_tier', 'los',
    'meal', 'market_segment', 'customer_type',
    'total_guests', 'is_repeated_guest', 'has_special_requests',
    'is_non_refund', 'previous_cancellations', 'lead_time_bucket'
]

DISCRETE_COLUMNS = [
    'hotel_encoded', 'month_num', 'room_tier', 'meal',
    'market_segment', 'customer_type', 'is_repeated_guest',
    'has_special_requests', 'is_non_refund', 'previous_cancellations',
    'lead_time_bucket'
]

CONTINUOUS_COLUMNS = ['los', 'total_guests']

# Encoding maps (must match 06_train_cancel_model.py exactly)
SEGMENT_ENCODE = {
    'Aviation': 0, 'Complementary': 1, 'Corporate': 2, 'Direct': 3,
    'Groups': 4, 'Offline TA/TO': 5, 'Online TA': 6
}
CUSTOMER_TYPE_ENCODE = {
    'Transient': 0, 'Transient-Party': 1, 'Contract': 2, 'Group': 3
}

LOS_CAP = {'city': 9, 'resort': 14}

# ─── Load data ─────────────────────────────────────────────────────────────────
print("Loading df_featured.csv...")
df = pd.read_csv(INPUT_FILE, parse_dates=['arrival_date'])

# Use only training rows (arrival_date < 2020-01-01)
df_train = df[df['arrival_date'] < '2020-01-01'].copy()
print(f"Training rows: {len(df_train)}")

# Keep only profile columns
df_profile = df_train[PROFILE_COLUMNS].copy()
print(f"Profile columns: {len(PROFILE_COLUMNS)}")
print(f"Profile shape: {df_profile.shape}")

# Ensure integer types for discrete columns
for col in DISCRETE_COLUMNS:
    if col not in ['meal', 'market_segment', 'customer_type']:
        df_profile[col] = df_profile[col].fillna(0).astype(int)

# ─── Build SDV Metadata ───────────────────────────────────────────────────────
print("\nBuilding SDV Metadata...")

metadata = SingleTableMetadata()
metadata.detect_from_dataframe(df_profile)

# Override sdtypes — auto-detect may get some wrong
for col in DISCRETE_COLUMNS:
    metadata.update_column(col, sdtype='categorical')

for col in CONTINUOUS_COLUMNS:
    metadata.update_column(col, sdtype='numerical')

print("  Metadata configured")
print(f"  Columns: {metadata.columns}")

# ─── Train CTGAN ──────────────────────────────────────────────────────────────
print("\nTraining CTGANSynthesizer...")
print("  epochs=300, batch_size=500, generator_dim=(256,256), discriminator_dim=(256,256), pac=10")
print("  This may take 30-90 minutes...\n")

synthesizer = CTGANSynthesizer(
    metadata,
    epochs=300,
    batch_size=500,
    generator_dim=(256, 256),
    discriminator_dim=(256, 256),
    pac=10,
    verbose=True
)

synthesizer.fit(df_profile)
print("\n  Training complete!")

# ─── Save model ───────────────────────────────────────────────────────────────
model_path = os.path.join(MODELS_DIR, 'ctgan_model.pkl')
synthesizer.save(model_path)
print(f"\nSaved ctgan_model.pkl to {model_path}")

# ─── Save metadata JSON ──────────────────────────────────────────────────────
metadata_dict = {
    'trained_date': str(date.today()),
    'training_rows': int(len(df_profile)),
    'discrete_columns': DISCRETE_COLUMNS,
    'continuous_columns': CONTINUOUS_COLUMNS,
    'column_order': PROFILE_COLUMNS,
    'los_cap': LOS_CAP,
    'market_segment_encoding': SEGMENT_ENCODE,
    'customer_type_encoding': CUSTOMER_TYPE_ENCODE
}

metadata_path = os.path.join(MODELS_DIR, 'ctgan_metadata.json')
with open(metadata_path, 'w') as f:
    json.dump(metadata_dict, f, indent=2)
print(f"Saved ctgan_metadata.json to {metadata_path}")

# ─── Verification ─────────────────────────────────────────────────────────────
print("\n── Verification: 200 samples for City Hotel January ──")

# Use sample_remaining_columns with conditions
condition_df = pd.DataFrame({
    'hotel_encoded': [0] * 200,
    'month_num': [1] * 200
})

try:
    samples = synthesizer.sample_remaining_columns(condition_df)
except Exception:
    # Fallback: sample unconditionally and filter
    print("  Conditioned sampling not available, sampling + filtering...")
    raw_samples = synthesizer.sample(num_rows=2000)
    samples = raw_samples[
        (raw_samples['hotel_encoded'].round() == 0) &
        (raw_samples['month_num'].round() == 1)
    ].head(200)

print(f"Generated {len(samples)} samples")

# Check metrics against profile_params.json expectations
mean_los = samples['los'].clip(lower=1).mean()
room_tier_1_share = (samples['room_tier'].round().clip(1, 4) == 1).mean()
online_ta_share = (samples['market_segment'] == 'Online TA').mean()
non_refund_rate = (samples['is_non_refund'].round().clip(0, 1) == 1).mean()
mean_total_guests = samples['total_guests'].clip(lower=1).mean()

print(f"\n{'Metric':<25} {'Value':>8} {'Expected':>10} {'Range':>15} {'Status':>8}")
print("-" * 75)

checks = [
    ('Mean LOS', mean_los, 2.9, 2.4, 3.4),
    ('Room tier 1 share', room_tier_1_share, 0.81, 0.70, 0.90),
    ('Online TA share', online_ta_share, 0.45, 0.35, 0.55),
    ('Non-refund rate', non_refund_rate, 0.17, 0.12, 0.22),
    ('Mean total_guests', mean_total_guests, 1.7, 1.4, 2.0),
]

all_pass = True
for name, val, expected, lo, hi in checks:
    status = "✅ PASS" if lo <= val <= hi else "❌ FAIL"
    if status == "❌ FAIL":
        all_pass = False
    print(f"{name:<25} {val:>8.3f} {expected:>10.2f} {f'[{lo}, {hi}]':>15} {status:>8}")

if all_pass:
    print("\n✅ All verification checks passed!")
else:
    print("\n⚠️  Some checks failed — consider increasing epochs or reviewing metadata.")

print(f"\n✅ CTGAN training complete!")
print(f"   ctgan_model.pkl, ctgan_metadata.json saved to {MODELS_DIR}")
