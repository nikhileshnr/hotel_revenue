"""
03_train_volume_model.py
Empirical Negative Binomial parameters per hotel×month.
Outputs: models/volume_params.json (24 hotel×month param combos)
"""

import pandas as pd
import numpy as np
import json
import os
import warnings
warnings.filterwarnings('ignore')

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
INPUT_FILE = os.path.join(DATA_DIR, 'df_featured.csv')

# ─── Load & use ALL pre-COVID data ────────────────────────────────────────────
# Volume params are distribution statistics (mu, alpha), not ML predictions.
# No train/val split needed — using all pre-COVID data gives the best estimates.
# The ML models (ADR, cancel, noshow) still use proper train/val splits.
print("Loading df_featured.csv...")
df = pd.read_csv(INPUT_FILE, parse_dates=['arrival_date'])

# Use all pre-COVID data for volume distribution fitting
df_all = df[df['arrival_date'] < '2020-03-01'].copy()

# Separate validation set for evaluation only
df_val = df[df['arrival_date'] >= '2020-01-01'].copy()

print(f"All pre-COVID data: {len(df_all)} rows")
print(f"Validation set (for evaluation): {len(df_val)} rows")

# ─── Aggregate to daily counts ────────────────────────────────────────────────
print("\nAggregating daily booking counts...")
daily_train = (
    df_all
    .groupby(['arrival_date', 'hotel', 'hotel_encoded', 'month_num'])
    .size()
    .reset_index(name='daily_count')
)
print(f"Training daily aggregation: {len(daily_train)} rows")

daily_val = (
    df_val
    .groupby(['arrival_date', 'hotel', 'hotel_encoded', 'month_num'])
    .size()
    .reset_index(name='daily_count')
)
print(f"Validation daily aggregation: {len(daily_val)} rows")

# ─── Empirical Method-of-Moments per hotel × month ───────────────────────────
# NegBinom parameterization: mean = mu, var = mu + alpha * mu^2
# So: alpha = (var - mu) / mu^2   (when var > mu, i.e. overdispersed)
# scipy nbinom uses (n, p): n = 1/alpha, p = n/(n + mu)
print("\nComputing empirical (mu, alpha) per hotel × month...")

month_names = {
    1: 'January', 2: 'February', 3: 'March', 4: 'April',
    5: 'May', 6: 'June', 7: 'July', 8: 'August',
    9: 'September', 10: 'October', 11: 'November', 12: 'December'
}

volume_params = {}
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    volume_params[hotel_name] = {}
    hotel_daily = daily_train[daily_train['hotel_encoded'] == hotel_enc]

    for m in range(1, 13):
        month_data = hotel_daily[hotel_daily['month_num'] == m]

        if len(month_data) == 0:
            mu_val = 50.0
            alpha_val = 0.2
        else:
            # Apply year-based exponential weights to favour recent data
            month_data = month_data.copy()
            month_data['year'] = pd.to_datetime(month_data['arrival_date']).dt.year
            max_year = month_data['year'].max()

            # Year-based exponential weighting so recent years dominate μ estimate
            # 2015-16 data had lower volumes; 2018-19 better represents 2020 validation
            year_weights = {2015: 1, 2016: 1.5, 2017: 2, 2018: 3, 2019: 4, 2020: 4}
            month_data['weight'] = month_data['year'].apply(lambda y: year_weights.get(y, 1.0))

            counts = month_data['daily_count'].values.astype(float)
            weights = month_data['weight'].values.astype(float)

            # Weighted mean
            mu_val = float(np.average(counts, weights=weights))

            # Weighted variance
            w_sum = weights.sum()
            var_val = float(np.average((counts - mu_val) ** 2, weights=weights))

            if var_val > mu_val and mu_val > 0:
                alpha_val = (var_val - mu_val) / (mu_val ** 2)
            else:
                alpha_val = 0.1

        volume_params[hotel_name][month_names[m]] = {
            'mu': round(mu_val, 2),
            'alpha': round(max(alpha_val, 0.01), 4)
        }
        print(f"  {hotel_name} / {month_names[m]}: mu={mu_val:.1f}, alpha={alpha_val:.4f} (n={len(month_data)} days)")

# ─── Evaluation on Validation Set ─────────────────────────────────────────────
print("\n── Evaluation on Validation Set (Jan–Feb 2020) ──")

for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    val_hotel = daily_val[daily_val['hotel_encoded'] == hotel_enc]
    if len(val_hotel) == 0:
        print(f"  {hotel_name}: no validation data")
        continue

    actual_val = val_hotel['daily_count'].values

    # Use per-month mu as prediction
    pred_val = []
    for _, row in val_hotel.iterrows():
        m_name = month_names[int(row['month_num'])]
        pred_val.append(volume_params[hotel_name][m_name]['mu'])
    pred_val = np.array(pred_val)

    mae = np.mean(np.abs(actual_val - pred_val))
    target = 15 if hotel_enc == 0 else 10
    status = "✅" if mae < target else "🟠"
    print(f"  {hotel_name} — MAE: {mae:.1f} bookings/day (target: <{target}) {status}")
    print(f"              Actual mean: {actual_val.mean():.1f}, Predicted mean: {pred_val.mean():.1f}")

# ─── Save ──────────────────────────────────────────────────────────────────────
output_path = os.path.join(MODELS_DIR, 'volume_params.json')
with open(output_path, 'w') as f:
    json.dump(volume_params, f, indent=2)

print(f"\n✅ Saved volume_params.json to {output_path}")
