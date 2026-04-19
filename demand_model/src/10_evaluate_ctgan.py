"""
10_evaluate_ctgan.py
Evaluates CTGAN model quality by comparing synthetic vs real data distributions.
Uses SDV's built-in quality metrics + custom statistical comparisons.
"""

import pandas as pd
import numpy as np
import json
import os

from sdv.metadata import SingleTableMetadata
from sdv.single_table import CTGANSynthesizer
from sdv.evaluation.single_table import evaluate_quality, run_diagnostic
import torch

# ─── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')

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

# ─── Load real data ────────────────────────────────────────────────────────────
print("Loading real data...")
df = pd.read_csv(os.path.join(DATA_DIR, 'df_featured.csv'), parse_dates=['arrival_date'])
df_train = df[df['arrival_date'] < '2020-01-01'].copy()
df_real = df_train[PROFILE_COLUMNS].copy()

for col in DISCRETE_COLUMNS:
    if col not in ['meal', 'market_segment', 'customer_type']:
        df_real[col] = df_real[col].fillna(0).astype(int)

print(f"  Real data: {len(df_real)} rows")

# ─── Build metadata ───────────────────────────────────────────────────────────
metadata = SingleTableMetadata()
metadata.detect_from_dataframe(df_real)
for col in DISCRETE_COLUMNS:
    metadata.update_column(col, sdtype='categorical')
for col in CONTINUOUS_COLUMNS:
    metadata.update_column(col, sdtype='numerical')

# ─── Load CTGAN and generate synthetic data ────────────────────────────────────
print("\nLoading CTGAN model...")
_original = torch.load
torch.load = lambda *a, **kw: _original(*a, **{**kw, 'map_location': 'cpu', 'weights_only': False})
try:
    synthesizer = CTGANSynthesizer.load(os.path.join(MODELS_DIR, 'ctgan_model.pkl'))
finally:
    torch.load = _original

N_SYNTHETIC = 10000
print(f"Generating {N_SYNTHETIC} synthetic samples...")
df_synthetic = synthesizer.sample(num_rows=N_SYNTHETIC)
print(f"  Synthetic data: {len(df_synthetic)} rows")

# ═══════════════════════════════════════════════════════════════════════════════
# 1. SDV QUALITY REPORT
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("  SDV QUALITY REPORT")
print("=" * 70)

quality_report = evaluate_quality(df_real, df_synthetic, metadata)
print(f"\n  Overall Quality Score: {quality_report.get_score():.4f}")
print(f"  (1.0 = perfect replica, 0.5 = random noise)")

# Column shapes
print("\n  Column Shape Scores:")
cs = quality_report.get_details('Column Shapes')
score_col = [c for c in cs.columns if 'score' in c.lower()][0]
col_col = [c for c in cs.columns if 'column' in c.lower()][0]
for _, row in cs.iterrows():
    score = row[score_col]
    status = "✅" if score >= 0.80 else "⚠️" if score >= 0.60 else "❌"
    print(f"    {status} {str(row[col_col]):<25} {score:.4f}")

# Column pair trends
print("\n  Column Pair Trend Scores (top 10 + worst 5):")
cp = quality_report.get_details('Column Pair Trends')
cp_score_col = [c for c in cp.columns if 'score' in c.lower()][0]
cp_cols = [c for c in cp.columns if 'column' in c.lower()]
cp_sorted = cp.sort_values(cp_score_col, ascending=False)
# Show top 10 and worst 5
show = pd.concat([cp_sorted.head(10), cp_sorted.tail(5)]).drop_duplicates()
for _, row in show.iterrows():
    score = row[cp_score_col]
    status = "✅" if score >= 0.80 else "⚠️" if score >= 0.60 else "❌"
    c1 = str(row[cp_cols[0]]) if len(cp_cols) > 0 else "?"
    c2 = str(row[cp_cols[1]]) if len(cp_cols) > 1 else "?"
    print(f"    {status} {c1} ↔ {c2:<30} {score:.4f}")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. DIAGNOSTIC REPORT
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("  SDV DIAGNOSTIC REPORT")
print("=" * 70)

diagnostic = run_diagnostic(df_real, df_synthetic, metadata)
print(f"\n  Overall Diagnostic Score: {diagnostic.get_score():.4f}")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. CUSTOM DISTRIBUTION COMPARISON
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("  DISTRIBUTION COMPARISON (Real vs Synthetic)")
print("=" * 70)

# Categorical columns
print(f"\n{'Column':<25} {'Category':<20} {'Real %':>8} {'Synth %':>8} {'Diff':>8}")
print("-" * 75)

for col in ['meal', 'market_segment', 'customer_type']:
    real_dist = df_real[col].value_counts(normalize=True)
    synth_dist = df_synthetic[col].value_counts(normalize=True)
    for cat in real_dist.index:
        r = real_dist.get(cat, 0) * 100
        s = synth_dist.get(cat, 0) * 100
        diff = abs(r - s)
        status = "✅" if diff < 5 else "⚠️" if diff < 10 else "❌"
        print(f"  {status} {col:<23} {cat:<20} {r:>7.1f}% {s:>7.1f}% {diff:>+7.1f}pp")
    print()

# Numeric columns
print(f"\n{'Column':<25} {'Metric':<10} {'Real':>10} {'Synthetic':>10} {'Match':>8}")
print("-" * 70)

for col in ['hotel_encoded', 'room_tier', 'los', 'total_guests',
            'is_non_refund', 'is_repeated_guest', 'lead_time_bucket']:
    r_mean = df_real[col].astype(float).mean()
    s_mean = df_synthetic[col].astype(float).mean()
    r_std = df_real[col].astype(float).std()
    s_std = df_synthetic[col].astype(float).std()

    mean_diff = abs(r_mean - s_mean) / (r_mean + 0.001) * 100
    status_m = "✅" if mean_diff < 10 else "⚠️" if mean_diff < 20 else "❌"

    std_diff = abs(r_std - s_std) / (r_std + 0.001) * 100
    status_s = "✅" if std_diff < 20 else "⚠️" if std_diff < 35 else "❌"

    print(f"  {status_m} {col:<23} {'mean':<10} {r_mean:>10.3f} {s_mean:>10.3f} {mean_diff:>7.1f}%")
    print(f"  {status_s} {'':<23} {'std':<10} {r_std:>10.3f} {s_std:>10.3f} {std_diff:>7.1f}%")

# ═══════════════════════════════════════════════════════════════════════════════
# 4. CONDITIONED SAMPLING CHECK
# ═══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("  CONDITIONED SAMPLING CHECK")
print("=" * 70)

for hotel, hotel_name in [(0, 'City Hotel'), (1, 'Resort Hotel')]:
    for month in [1, 7]:
        month_name = 'January' if month == 1 else 'July'
        cond_df = pd.DataFrame({'hotel_encoded': [hotel]*200, 'month_num': [month]*200})
        try:
            samples = synthesizer.sample_remaining_columns(cond_df)
        except:
            samples = synthesizer.sample(num_rows=200)

        real_sub = df_real[(df_real['hotel_encoded'] == hotel) & (df_real['month_num'] == month)]

        print(f"\n  {hotel_name} — {month_name} (200 synthetic vs {len(real_sub)} real)")
        print(f"  {'Metric':<25} {'Real':>10} {'Synthetic':>10}")
        print(f"  {'-'*50}")
        print(f"  {'Mean LOS':<25} {real_sub['los'].mean():>10.2f} {samples['los'].clip(lower=1).mean():>10.2f}")
        print(f"  {'Mean total_guests':<25} {real_sub['total_guests'].mean():>10.2f} {samples['total_guests'].clip(lower=1).mean():>10.2f}")
        print(f"  {'Non-refund rate':<25} {real_sub['is_non_refund'].mean():>10.2%} {(samples['is_non_refund'].round().clip(0,1)==1).mean():>10.2%}")
        print(f"  {'Repeated guest rate':<25} {real_sub['is_repeated_guest'].mean():>10.2%} {(samples['is_repeated_guest'].round().clip(0,1)==1).mean():>10.2%}")

print("\n✅ CTGAN evaluation complete!")
