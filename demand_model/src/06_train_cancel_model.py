"""
06_train_cancel_model.py
LightGBM Classifier for cancellation (with Platt scaling calibration)
+ separate No-Show classifier.
Outputs: models/cancel_model.pkl (CalibratedClassifierCV), models/noshow_model.pkl
Updates: models/pipeline_config.json with feature orders.
"""

import pandas as pd
import numpy as np
import json
import os
import warnings
warnings.filterwarnings('ignore')

import lightgbm as lgb
import joblib
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, brier_score_loss, average_precision_score

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
INPUT_FILE = os.path.join(DATA_DIR, 'df_featured.csv')

# ─── Feature sets (from plan §7) ──────────────────────────────────────────────
CANCEL_FEATURES = [
    'is_non_refund', 'lead_time_bucket', 'has_prev_cancellations',
    'is_repeated_guest', 'market_segment_encoded', 'has_special_requests',
    'booking_changes', 'days_in_waiting_list', 'hotel_encoded',
    'month_num', 'los', 'room_tier', 'lead_time',
    'loyalty_score', 'customer_type_encoded'
]

NOSHOW_FEATURES = [
    'hotel_encoded', 'lead_time_bucket', 'is_non_refund',
    'market_segment_encoded', 'month_num', 'total_guests'
]

# Encoding maps (same as script 05)
SEGMENT_ENCODE = {
    'Aviation': 0, 'Complementary': 1, 'Corporate': 2, 'Direct': 3,
    'Groups': 4, 'Offline TA/TO': 5, 'Online TA': 6
}
CUSTOMER_TYPE_ENCODE = {
    'Transient': 0, 'Transient-Party': 1, 'Contract': 2, 'Group': 3
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

# Encode categoricals
df['market_segment_encoded'] = df['market_segment'].map(SEGMENT_ENCODE).fillna(0).astype(int)
df['customer_type_encoded'] = df['customer_type'].map(CUSTOMER_TYPE_ENCODE).fillna(0).astype(int)

# Train/Val split
df_train = df[df['arrival_date'] < '2020-01-01'].copy()
df_val = df[df['arrival_date'] >= '2020-01-01'].copy()
print(f"Training: {len(df_train)}, Validation: {len(df_val)}")
print(f"Cancellation rate (train): {df_train['target_cancel'].mean():.3f}")
print(f"No-show rate (train): {df_train['target_noshow'].mean():.4f}")

# ======================================================================
# CANCELLATION MODEL
# ======================================================================
print(f"\n{'='*60}")
print("Training Cancellation Model")
print(f"{'='*60}")

X_train_cancel = df_train[CANCEL_FEATURES].astype(float)
y_train_cancel = df_train['target_cancel'].astype(int)
X_val_cancel = df_val[CANCEL_FEATURES].astype(float)
y_val_cancel = df_val['target_cancel'].astype(int)

# LightGBM Classifier with is_unbalance
cancel_lgb = lgb.LGBMClassifier(
    objective='binary',
    metric='auc',
    n_estimators=400,
    learning_rate=0.05,
    num_leaves=63,
    max_depth=-1,
    min_child_samples=30,
    subsample=0.8,
    colsample_bytree=0.8,
    is_unbalance=True,
    reg_alpha=0.1,
    reg_lambda=0.1,
    random_state=42,
    n_jobs=-1,
    verbose=-1
)

cancel_lgb.fit(
    X_train_cancel, y_train_cancel,
    eval_set=[(X_val_cancel, y_val_cancel)],
    callbacks=[
        lgb.early_stopping(50, verbose=True),
        lgb.log_evaluation(100)
    ]
)

# Evaluate raw model
raw_proba_val = cancel_lgb.predict_proba(X_val_cancel)[:, 1]
auc_raw = roc_auc_score(y_val_cancel, raw_proba_val)
brier_raw = brier_score_loss(y_val_cancel, raw_proba_val)
print(f"\nRaw model — AUC-ROC: {auc_raw:.4f}, Brier: {brier_raw:.4f}")

# ─── Platt Scaling Calibration ────────────────────────────────────────────────
print("\nApplying Platt Scaling calibration...")
calibrated_cancel = CalibratedClassifierCV(
    cancel_lgb, method='sigmoid', cv=5
)
calibrated_cancel.fit(X_train_cancel, y_train_cancel)

# Evaluate calibrated model
cal_proba_val = calibrated_cancel.predict_proba(X_val_cancel)[:, 1]
auc_cal = roc_auc_score(y_val_cancel, cal_proba_val)
brier_cal = brier_score_loss(y_val_cancel, cal_proba_val)
print(f"Calibrated — AUC-ROC: {auc_cal:.4f} (target: > 0.82)")
print(f"Calibrated — Brier:   {brier_cal:.4f} (target: < 0.18)")

# Reliability diagram (text-based)
print("\nReliability diagram (10 bins):")
print(f"{'Bin':>8} {'Predicted':>10} {'Actual':>8} {'Count':>7}")
for i in range(10):
    lo, hi = i * 0.1, (i + 1) * 0.1
    mask = (cal_proba_val >= lo) & (cal_proba_val < hi)
    if mask.sum() > 0:
        pred_mean = cal_proba_val[mask].mean()
        actual_mean = y_val_cancel.values[mask].mean()
        print(f"{lo:.1f}-{hi:.1f}  {pred_mean:>10.3f} {actual_mean:>8.3f} {mask.sum():>7d}")

# Risk badge distribution
print("\nRisk badge distribution (validation):")
low = (cal_proba_val < 0.25).sum()
med = ((cal_proba_val >= 0.25) & (cal_proba_val < 0.55)).sum()
high = (cal_proba_val >= 0.55).sum()
total = len(cal_proba_val)
print(f"  🟢 Low (<0.25):  {low} ({100*low/total:.1f}%)")
print(f"  🟡 Medium:       {med} ({100*med/total:.1f}%)")
print(f"  🔴 High (≥0.55): {high} ({100*high/total:.1f}%)")

# ─── Joblib Export — Save the full CalibratedClassifierCV wrapper ─────────────
# Platt scaling is baked into predict_proba — no separate A/B params needed
cancel_pkl_path = os.path.join(MODELS_DIR, 'cancel_model.pkl')
joblib.dump(calibrated_cancel, cancel_pkl_path)
print(f"\nSaved cancel_model.pkl (CalibratedClassifierCV with Platt scaling baked in)")

# Verify joblib export
print("Verifying cancel joblib export...")
loaded_cancel = joblib.load(cancel_pkl_path)
verify_proba = loaded_cancel.predict_proba(X_val_cancel.iloc[:5])[:, 1]
for i in range(min(5, len(verify_proba))):
    print(f"  Sample {i}: p_cancel={verify_proba[i]:.4f}")

# ======================================================================
# NO-SHOW MODEL
# ======================================================================
print(f"\n{'='*60}")
print("Training No-Show Model")
print(f"{'='*60}")

X_train_noshow = df_train[NOSHOW_FEATURES].astype(float)
y_train_noshow = df_train['target_noshow'].astype(int)
X_val_noshow = df_val[NOSHOW_FEATURES].astype(float)
y_val_noshow = df_val['target_noshow'].astype(int)

# Compute scale_pos_weight for severe imbalance (~1.04% positive)
n_neg = (y_train_noshow == 0).sum()
n_pos = (y_train_noshow == 1).sum()
scale_weight = n_neg / max(n_pos, 1)
print(f"No-show positives: {n_pos}, negatives: {n_neg}, scale_pos_weight: {scale_weight:.1f}")

noshow_lgb = lgb.LGBMClassifier(
    objective='binary',
    metric='auc',
    n_estimators=400,
    learning_rate=0.05,
    num_leaves=63,
    max_depth=-1,
    min_child_samples=30,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=scale_weight,
    reg_alpha=0.1,
    reg_lambda=0.1,
    random_state=42,
    n_jobs=-1,
    verbose=-1
)

noshow_lgb.fit(
    X_train_noshow, y_train_noshow,
    eval_set=[(X_val_noshow, y_val_noshow)],
    callbacks=[
        lgb.early_stopping(50, verbose=True),
        lgb.log_evaluation(100)
    ]
)

# Evaluate no-show
noshow_proba_val = noshow_lgb.predict_proba(X_val_noshow)[:, 1]
if y_val_noshow.sum() > 0:
    auc_noshow = roc_auc_score(y_val_noshow, noshow_proba_val)
    ap_noshow = average_precision_score(y_val_noshow, noshow_proba_val)
    print(f"\nNo-Show — AUC-ROC: {auc_noshow:.4f}")
    print(f"No-Show — AUC-PR:  {ap_noshow:.4f} (target: > 0.15, baseline ≈ 0.01)")
else:
    print("\nNo-show: no positive samples in validation set")

# ─── Joblib Export — No-Show (plain LightGBM, no calibration needed) ──────────
noshow_pkl_path = os.path.join(MODELS_DIR, 'noshow_model.pkl')
joblib.dump(noshow_lgb, noshow_pkl_path)
print(f"\nSaved noshow_model.pkl")

# Verify
print("Verifying noshow joblib export...")
loaded_noshow = joblib.load(noshow_pkl_path)
verify_noshow = loaded_noshow.predict_proba(X_val_noshow.iloc[:5])[:, 1]
for i in range(min(5, len(verify_noshow))):
    print(f"  Sample {i}: p_noshow={verify_noshow[i]:.4f}")

# ─── Update pipeline_config.json ──────────────────────────────────────────────
config_path = os.path.join(MODELS_DIR, 'pipeline_config.json')
with open(config_path, 'r') as f:
    pipeline_config = json.load(f)

pipeline_config['cancel_feature_order'] = CANCEL_FEATURES
pipeline_config['noshow_feature_order'] = NOSHOW_FEATURES
# Remove cancel_calibration — Platt scaling is baked into the pkl
if 'cancel_calibration' in pipeline_config:
    del pipeline_config['cancel_calibration']

with open(config_path, 'w') as f:
    json.dump(pipeline_config, f, indent=2)

print(f"\n✅ Cancellation and No-Show models saved successfully")
print(f"   cancel_model.pkl (CalibratedClassifierCV — Platt scaling baked in)")
print(f"   noshow_model.pkl (raw LightGBM)")
print(f"   pipeline_config.json updated with cancel/noshow feature orders")
print(f"   cancel_calibration section REMOVED from pipeline_config.json")
