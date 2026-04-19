"""
05_train_adr_model.py
LightGBM Regressor for ADR (willingness-to-pay).
Trains separate models per hotel type.
Outputs: models/adr_model_city.pkl, models/adr_model_resort.pkl
Also writes ADR noise std and feature order to pipeline_config.json.
"""

import pandas as pd
import numpy as np
import json
import os
import lightgbm as lgb
import joblib

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
INPUT_FILE = os.path.join(DATA_DIR, 'df_featured.csv')

# ─── Feature set (from plan §6) ───────────────────────────────────────────────
ADR_FEATURES = [
    'hotel_encoded', 'room_tier', 'month_num', 'is_summer',
    'is_weekend_arrival', 'los', 'total_guests', 'has_special_requests',
    'is_repeated_guest', 'is_non_refund', 'lead_time_bucket',
    'market_segment_encoded', 'customer_type_encoded'
]

# Encoding maps
SEGMENT_ENCODE = {
    'Aviation': 0, 'Complementary': 1, 'Corporate': 2, 'Direct': 3,
    'Groups': 4, 'Offline TA/TO': 5, 'Online TA': 6
}
CUSTOMER_TYPE_ENCODE = {
    'Transient': 0, 'Transient-Party': 1, 'Contract': 2, 'Group': 3
}

# LightGBM hyperparameters — per hotel
# Resort Hotel gets more capacity to push R² above 0.50
LGB_PARAMS_CITY = {
    'objective': 'regression',
    'metric': 'rmse',
    'n_estimators': 500,
    'learning_rate': 0.05,
    'num_leaves': 63,
    'max_depth': -1,
    'min_child_samples': 30,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'reg_alpha': 0.1,
    'reg_lambda': 0.1,
    'random_state': 42,
    'n_jobs': -1,
    'verbose': -1
}

LGB_PARAMS_RESORT = {
    'objective': 'regression',
    'metric': 'rmse',
    'n_estimators': 800,
    'learning_rate': 0.03,
    'num_leaves': 127,
    'max_depth': -1,
    'min_child_samples': 20,
    'subsample': 0.85,
    'colsample_bytree': 0.85,
    'reg_alpha': 0.05,
    'reg_lambda': 0.05,
    'random_state': 42,
    'n_jobs': -1,
    'verbose': -1
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

# Encode categorical features
df['market_segment_encoded'] = df['market_segment'].map(SEGMENT_ENCODE).fillna(0).astype(int)
df['customer_type_encoded'] = df['customer_type'].map(CUSTOMER_TYPE_ENCODE).fillna(0).astype(int)

# Filter to Check-Out only (learn ADR from completed stays)
df_checkout = df[df['reservation_status'] == 'Check-Out'].copy()
print(f"Check-Out rows: {len(df_checkout)}")

# Train/Val split
df_train = df_checkout[df_checkout['arrival_date'] < '2020-01-01'].copy()
df_val = df_checkout[df_checkout['arrival_date'] >= '2020-01-01'].copy()
print(f"Training: {len(df_train)} rows, Validation: {len(df_val)} rows")

# ─── Store pipeline config incrementally ──────────────────────────────────────
config_path = os.path.join(MODELS_DIR, 'pipeline_config.json')
if os.path.exists(config_path):
    with open(config_path, 'r') as f:
        pipeline_config = json.load(f)
else:
    pipeline_config = {}

pipeline_config['adr_feature_order'] = ADR_FEATURES
pipeline_config['segment_encode'] = SEGMENT_ENCODE
pipeline_config['customer_type_encode'] = CUSTOMER_TYPE_ENCODE

adr_noise_std = {}
los_cap = {}

# ─── Train separate models per hotel ──────────────────────────────────────────
for hotel_name, hotel_enc in [('City Hotel', 0), ('Resort Hotel', 1)]:
    print(f"\n{'='*60}")
    print(f"Training ADR model for {hotel_name}")
    print(f"{'='*60}")

    # Filter
    train_h = df_train[df_train['hotel_encoded'] == hotel_enc]
    val_h = df_val[df_val['hotel_encoded'] == hotel_enc]
    print(f"  Train: {len(train_h)}, Val: {len(val_h)}")

    X_train = train_h[ADR_FEATURES].astype(float)
    y_train = train_h['adr'].astype(float)
    X_val = val_h[ADR_FEATURES].astype(float)
    y_val = val_h['adr'].astype(float)

    # Select hyperparameters per hotel
    params = LGB_PARAMS_CITY if hotel_enc == 0 else LGB_PARAMS_RESORT

    # Train with early stopping
    model = lgb.LGBMRegressor(**params)
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[
            lgb.early_stopping(50, verbose=True),
            lgb.log_evaluation(100)
        ]
    )

    # Evaluate
    pred_train = model.predict(X_train)
    pred_val = model.predict(X_val)

    rmse_train = np.sqrt(np.mean((y_train - pred_train) ** 2))
    rmse_val = np.sqrt(np.mean((y_val - pred_val) ** 2))
    r2_val = 1 - np.sum((y_val - pred_val) ** 2) / np.sum((y_val - y_val.mean()) ** 2)

    print(f"\n  RMSE (train): {rmse_train:.2f}")
    print(f"  RMSE (val):   {rmse_val:.2f} (target: < 30)")
    print(f"  R² (val):     {r2_val:.4f} (target: > 0.50)")

    # Compute residual_std for noise injection
    residuals = y_train.values - pred_train
    res_std = float(np.std(residuals))
    adr_noise_std[hotel_name] = round(res_std, 2)
    print(f"  Residual std (for noise): {res_std:.2f}")

    # LoS cap from training data
    los_cap_val = float(train_h['los'].quantile(0.99))
    los_cap[hotel_name] = int(los_cap_val)

    # Feature importance
    print(f"\n  Top 5 features:")
    imp = model.feature_importances_
    idx = np.argsort(imp)[::-1][:5]
    for i in idx:
        print(f"    {ADR_FEATURES[i]}: {imp[i]}")

    # ─── Joblib Export ─────────────────────────────────────────────────────────
    pkl_filename = 'adr_model_city.pkl' if hotel_enc == 0 else 'adr_model_resort.pkl'
    pkl_path = os.path.join(MODELS_DIR, pkl_filename)
    joblib.dump(model, pkl_path)
    print(f"\n  Saved {pkl_filename}")

    # Quick verify: reload and predict 5 samples
    print(f"  Verifying joblib export...")
    loaded = joblib.load(pkl_path)
    verify_pred = loaded.predict(X_val.iloc[:5])
    for i in range(min(5, len(verify_pred))):
        print(f"    Sample {i}: ADR={verify_pred[i]:.2f}")

# ─── Write to pipeline_config.json ────────────────────────────────────────────
pipeline_config['adr_noise_std'] = adr_noise_std
pipeline_config['los_cap'] = los_cap
pipeline_config['risk_badge_thresholds'] = {'low': 0.25, 'high': 0.55}
pipeline_config['revenue_formula'] = 'net_adr * los + meal_cost * los'
pipeline_config['cancellation_revenue_recovery'] = {
    'No Deposit': 0.0,
    'Non Refund': 1.0,
    'Refundable': 0.35
}

with open(config_path, 'w') as f:
    json.dump(pipeline_config, f, indent=2)

print(f"\n✅ ADR models saved successfully")
print(f"   adr_model_city.pkl, adr_model_resort.pkl")
print(f"   pipeline_config.json updated with ADR noise std, LoS caps, feature order")
