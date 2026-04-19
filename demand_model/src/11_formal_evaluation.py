"""
11_formal_evaluation.py
Formal model evaluation with train/test metrics, confusion matrices,
classification reports, and regression diagnostics.

Outputs: EVALUATION_REPORT.md in demand_model/ root
"""

import pandas as pd
import numpy as np
import json
import os
import joblib
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_auc_score,
    brier_score_loss, average_precision_score, accuracy_score,
    precision_recall_curve, mean_squared_error, mean_absolute_error, r2_score
)

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
INPUT_FILE = os.path.join(DATA_DIR, 'df_featured.csv')
REPORT_FILE = os.path.join(BASE_DIR, 'EVALUATION_REPORT.md')

# ─── Encoding maps ───────────────────────────────────────────────────────────
SEGMENT_ENCODE = {
    'Aviation': 0, 'Complementary': 1, 'Corporate': 2, 'Direct': 3,
    'Groups': 4, 'Offline TA/TO': 5, 'Online TA': 6
}
CUSTOMER_TYPE_ENCODE = {
    'Transient': 0, 'Transient-Party': 1, 'Contract': 2, 'Group': 3
}

# Feature sets (must match training scripts)
ADR_FEATURES = [
    'hotel_encoded', 'room_tier', 'month_num', 'is_summer',
    'is_weekend_arrival', 'los', 'total_guests', 'has_special_requests',
    'is_repeated_guest', 'is_non_refund', 'lead_time_bucket',
    'market_segment_encoded', 'customer_type_encoded'
]

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


def fmt_cm(cm, labels):
    """Format confusion matrix as markdown table."""
    header = f"| {'':>12} | {'Pred ' + labels[0]:>14} | {'Pred ' + labels[1]:>14} |"
    sep = f"|{'-'*14}|{'-'*16}|{'-'*16}|"
    row0 = f"| {'True ' + labels[0]:>12} | {cm[0,0]:>14,} | {cm[0,1]:>14,} |"
    row1 = f"| {'True ' + labels[1]:>12} | {cm[1,0]:>14,} | {cm[1,1]:>14,} |"
    return '\n'.join([header, sep, row0, row1])


def fmt_clf_report(y_true, y_pred, y_proba, labels):
    """Generate full classification metrics block."""
    cm = confusion_matrix(y_true, y_pred)
    report = classification_report(y_true, y_pred, target_names=labels, digits=4)
    auc = roc_auc_score(y_true, y_proba) if y_true.sum() > 0 else float('nan')
    brier = brier_score_loss(y_true, y_proba)
    ap = average_precision_score(y_true, y_proba) if y_true.sum() > 0 else float('nan')
    acc = accuracy_score(y_true, y_pred)

    lines = []
    lines.append(f"**Accuracy:** {acc:.4f}")
    lines.append(f"**AUC-ROC:** {auc:.4f}")
    lines.append(f"**AUC-PR (Average Precision):** {ap:.4f}")
    lines.append(f"**Brier Score:** {brier:.4f}")
    lines.append("")
    lines.append("**Confusion Matrix:**")
    lines.append("")
    lines.append(fmt_cm(cm, labels))
    lines.append("")
    lines.append("**Classification Report:**")
    lines.append("```")
    lines.append(report.strip())
    lines.append("```")
    return '\n'.join(lines)


def reliability_diagram(y_true, y_proba, n_bins=10):
    """Text-based reliability diagram as markdown table."""
    lines = ["| Bin | Predicted | Actual | Count | Gap |",
             "|-----|-----------|--------|-------|-----|"]
    for i in range(n_bins):
        lo, hi = i / n_bins, (i + 1) / n_bins
        mask = (y_proba >= lo) & (y_proba < hi)
        if mask.sum() > 0:
            pred_mean = y_proba[mask].mean()
            actual_mean = y_true.values[mask].mean()
            gap = abs(pred_mean - actual_mean)
            lines.append(f"| {lo:.1f}–{hi:.1f} | {pred_mean:.4f} | {actual_mean:.4f} | {mask.sum():>5,} | {gap:.4f} |")
    return '\n'.join(lines)


# ─── Load data ────────────────────────────────────────────────────────────────
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
df['market_segment_encoded'] = df['market_segment'].map(SEGMENT_ENCODE).fillna(0).astype(int)
df['customer_type_encoded'] = df['customer_type'].map(CUSTOMER_TYPE_ENCODE).fillna(0).astype(int)

# Same split as training
df_train = df[df['arrival_date'] < '2020-01-01'].copy()
df_test = df[df['arrival_date'] >= '2020-01-01'].copy()

print(f"Train: {len(df_train):,} rows | Test: {len(df_test):,} rows")
print(f"Split date: 2020-01-01 (temporal split)\n")

report_lines = []
report_lines.append("# Model Evaluation Report")
report_lines.append("")
report_lines.append(f"**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}")
report_lines.append(f"**Dataset:** `df_featured.csv` ({len(df):,} rows)")
report_lines.append(f"**Split:** Temporal — Train < 2020-01-01, Test ≥ 2020-01-01")
report_lines.append(f"**Train size:** {len(df_train):,} rows | **Test size:** {len(df_test):,} rows")
report_lines.append("")
report_lines.append("---")
report_lines.append("")

# ═══════════════════════════════════════════════════════════════════════════════
# 1. ADR Regression Models
# ═══════════════════════════════════════════════════════════════════════════════
report_lines.append("## 1. ADR (Average Daily Rate) — Regression")
report_lines.append("")

# Filter to Check-Out only (same as training)
df_train_co = df_train[df_train['reservation_status'] == 'Check-Out'].copy()
df_test_co = df_test[df_test['reservation_status'] == 'Check-Out'].copy()

for hotel_name, hotel_enc, pkl_name in [
    ('City Hotel', 0, 'adr_model_city.pkl'),
    ('Resort Hotel', 1, 'adr_model_resort.pkl')
]:
    print(f"Evaluating ADR — {hotel_name}...")
    model = joblib.load(os.path.join(MODELS_DIR, pkl_name))

    train_h = df_train_co[df_train_co['hotel_encoded'] == hotel_enc]
    test_h = df_test_co[df_test_co['hotel_encoded'] == hotel_enc]

    X_train = train_h[ADR_FEATURES].astype(float)
    y_train = train_h['adr'].astype(float)
    X_test = test_h[ADR_FEATURES].astype(float)
    y_test = test_h['adr'].astype(float)

    pred_train = model.predict(X_train)
    pred_test = model.predict(X_test)

    # Train metrics
    rmse_train = np.sqrt(mean_squared_error(y_train, pred_train))
    mae_train = mean_absolute_error(y_train, pred_train)
    r2_train = r2_score(y_train, pred_train)

    # Test metrics
    rmse_test = np.sqrt(mean_squared_error(y_test, pred_test))
    mae_test = mean_absolute_error(y_test, pred_test)
    r2_test = r2_score(y_test, pred_test)
    mape_test = np.mean(np.abs((y_test - pred_test) / y_test.clip(lower=1))) * 100

    # Residual analysis
    residuals = y_test - pred_test
    res_mean = residuals.mean()
    res_std = residuals.std()

    report_lines.append(f"### 1.{'a' if hotel_enc == 0 else 'b'}. {hotel_name}")
    report_lines.append("")
    report_lines.append(f"**Training set:** {len(train_h):,} Check-Out rows")
    report_lines.append(f"**Test set:** {len(test_h):,} Check-Out rows")
    report_lines.append("")
    report_lines.append("| Metric | Train | Test |")
    report_lines.append("|--------|-------|------|")
    report_lines.append(f"| RMSE | {rmse_train:.2f} | {rmse_test:.2f} |")
    report_lines.append(f"| MAE | {mae_train:.2f} | {mae_test:.2f} |")
    report_lines.append(f"| R² | {r2_train:.4f} | {r2_test:.4f} |")
    report_lines.append(f"| MAPE | — | {mape_test:.1f}% |")
    report_lines.append("")
    report_lines.append(f"**Residual Analysis (test):** Mean = {res_mean:.2f}, Std = {res_std:.2f}")
    report_lines.append("")

    # Feature importance
    imp = model.feature_importances_
    idx = np.argsort(imp)[::-1]
    report_lines.append("**Feature Importance (top 5):**")
    report_lines.append("")
    report_lines.append("| Rank | Feature | Importance |")
    report_lines.append("|------|---------|------------|")
    for rank, i in enumerate(idx[:5], 1):
        report_lines.append(f"| {rank} | `{ADR_FEATURES[i]}` | {imp[i]} |")
    report_lines.append("")

    # Prediction distribution
    report_lines.append("**Prediction Distribution (test):**")
    report_lines.append("")
    report_lines.append(f"| Stat | Actual ADR | Predicted ADR |")
    report_lines.append(f"|------|-----------|--------------|")
    report_lines.append(f"| Mean | {y_test.mean():.2f} | {pred_test.mean():.2f} |")
    report_lines.append(f"| Median | {y_test.median():.2f} | {np.median(pred_test):.2f} |")
    report_lines.append(f"| Std | {y_test.std():.2f} | {pred_test.std():.2f} |")
    report_lines.append(f"| Min | {y_test.min():.2f} | {pred_test.min():.2f} |")
    report_lines.append(f"| Max | {y_test.max():.2f} | {pred_test.max():.2f} |")
    report_lines.append("")

    print(f"  RMSE: {rmse_test:.2f} | R²: {r2_test:.4f} | MAE: {mae_test:.2f}")

report_lines.append("---")
report_lines.append("")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Cancellation Model
# ═══════════════════════════════════════════════════════════════════════════════
print("\nEvaluating Cancellation Model...")
report_lines.append("## 2. Cancellation — Binary Classification")
report_lines.append("")

cancel_model = joblib.load(os.path.join(MODELS_DIR, 'cancel_model.pkl'))

X_train_c = df_train[CANCEL_FEATURES].astype(float)
y_train_c = df_train['target_cancel'].astype(int)
X_test_c = df_test[CANCEL_FEATURES].astype(float)
y_test_c = df_test['target_cancel'].astype(int)

# Train metrics
proba_train_c = cancel_model.predict_proba(X_train_c)[:, 1]
pred_train_c = (proba_train_c >= 0.5).astype(int)

# Test metrics
proba_test_c = cancel_model.predict_proba(X_test_c)[:, 1]
pred_test_c = (proba_test_c >= 0.5).astype(int)

report_lines.append(f"**Model:** LightGBM + CalibratedClassifierCV (Platt scaling)")
report_lines.append(f"**Features:** {len(CANCEL_FEATURES)}")
report_lines.append(f"**Class balance (train):** {y_train_c.mean():.3f} positive rate")
report_lines.append(f"**Class balance (test):** {y_test_c.mean():.3f} positive rate")
report_lines.append("")

# Train summary
auc_train_c = roc_auc_score(y_train_c, proba_train_c)
acc_train_c = accuracy_score(y_train_c, pred_train_c)

report_lines.append("### Train Set Summary")
report_lines.append(f"- **AUC-ROC:** {auc_train_c:.4f}")
report_lines.append(f"- **Accuracy:** {acc_train_c:.4f}")
report_lines.append("")

# Test detailed
report_lines.append("### Test Set (Full Evaluation)")
report_lines.append("")
report_lines.append(fmt_clf_report(y_test_c, pred_test_c, proba_test_c, ['No Cancel', 'Cancel']))
report_lines.append("")

# Reliability diagram
report_lines.append("### Calibration (Reliability Diagram)")
report_lines.append("")
report_lines.append(reliability_diagram(y_test_c, proba_test_c))
report_lines.append("")

# Risk badge distribution
report_lines.append("### Risk Badge Distribution (test set)")
report_lines.append("")
low = (proba_test_c < 0.25).sum()
med = ((proba_test_c >= 0.25) & (proba_test_c < 0.55)).sum()
high = (proba_test_c >= 0.55).sum()
total = len(proba_test_c)
report_lines.append(f"| Badge | Count | % | Actual Cancel Rate |")
report_lines.append(f"|-------|-------|---|-------------------|")
for badge, mask_b in [
    ('🟢 Green (<0.25)', proba_test_c < 0.25),
    ('🟡 Yellow (0.25–0.55)', (proba_test_c >= 0.25) & (proba_test_c < 0.55)),
    ('🔴 Red (≥0.55)', proba_test_c >= 0.55)
]:
    count = mask_b.sum()
    pct = 100 * count / total
    actual_rate = y_test_c.values[mask_b].mean() if count > 0 else 0
    report_lines.append(f"| {badge} | {count:,} | {pct:.1f}% | {actual_rate:.3f} |")
report_lines.append("")

# Overfit check
report_lines.append("### Overfit Check")
report_lines.append("")
auc_test_c = roc_auc_score(y_test_c, proba_test_c)
acc_test_c = accuracy_score(y_test_c, pred_test_c)
report_lines.append(f"| Metric | Train | Test | Gap |")
report_lines.append(f"|--------|-------|------|-----|")
report_lines.append(f"| AUC-ROC | {auc_train_c:.4f} | {auc_test_c:.4f} | {auc_train_c - auc_test_c:.4f} |")
report_lines.append(f"| Accuracy | {acc_train_c:.4f} | {acc_test_c:.4f} | {acc_train_c - acc_test_c:.4f} |")
report_lines.append("")

print(f"  AUC: {auc_test_c:.4f} | Acc: {acc_test_c:.4f}")

report_lines.append("---")
report_lines.append("")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. No-Show Model
# ═══════════════════════════════════════════════════════════════════════════════
print("\nEvaluating No-Show Model...")
report_lines.append("## 3. No-Show — Binary Classification")
report_lines.append("")

noshow_model = joblib.load(os.path.join(MODELS_DIR, 'noshow_model.pkl'))

X_train_ns = df_train[NOSHOW_FEATURES].astype(float)
y_train_ns = df_train['target_noshow'].astype(int)
X_test_ns = df_test[NOSHOW_FEATURES].astype(float)
y_test_ns = df_test['target_noshow'].astype(int)

proba_train_ns = noshow_model.predict_proba(X_train_ns)[:, 1]
pred_train_ns = (proba_train_ns >= 0.5).astype(int)
proba_test_ns = noshow_model.predict_proba(X_test_ns)[:, 1]
pred_test_ns = (proba_test_ns >= 0.5).astype(int)

report_lines.append(f"**Model:** LightGBM (raw, no calibration)")
report_lines.append(f"**Features:** {len(NOSHOW_FEATURES)}")
report_lines.append(f"**Class balance (train):** {y_train_ns.mean():.4f} positive rate ({y_train_ns.sum():,} positives)")
report_lines.append(f"**Class balance (test):** {y_test_ns.mean():.4f} positive rate ({y_test_ns.sum():,} positives)")
report_lines.append("")

report_lines.append("> [!NOTE]")
report_lines.append("> No-show is a rare event (~1% positive rate). Standard accuracy is misleading.")
report_lines.append("> Focus on AUC-PR and recall for the positive class.")
report_lines.append("")

# Train summary
if y_train_ns.sum() > 0:
    auc_train_ns = roc_auc_score(y_train_ns, proba_train_ns)
    report_lines.append("### Train Set Summary")
    report_lines.append(f"- **AUC-ROC:** {auc_train_ns:.4f}")
    report_lines.append("")

# Test detailed
report_lines.append("### Test Set (Full Evaluation)")
report_lines.append("")
if y_test_ns.sum() > 0:
    report_lines.append(fmt_clf_report(y_test_ns, pred_test_ns, proba_test_ns, ['Show', 'No-Show']))
else:
    report_lines.append("No positive samples in test set — cannot compute classification metrics.")
report_lines.append("")

# Threshold analysis for rare events
report_lines.append("### Threshold Analysis (No-Show)")
report_lines.append("")
report_lines.append("| Threshold | Precision | Recall | F1 | Flagged |")
report_lines.append("|-----------|-----------|--------|-----|---------|")
for thresh in [0.02, 0.05, 0.10, 0.20, 0.50]:
    pred_t = (proba_test_ns >= thresh).astype(int)
    tp = ((pred_t == 1) & (y_test_ns == 1)).sum()
    fp = ((pred_t == 1) & (y_test_ns == 0)).sum()
    fn = ((pred_t == 0) & (y_test_ns == 1)).sum()
    prec = tp / max(tp + fp, 1)
    rec = tp / max(tp + fn, 1)
    f1 = 2 * prec * rec / max(prec + rec, 1e-9)
    flagged = pred_t.sum()
    report_lines.append(f"| {thresh:.2f} | {prec:.4f} | {rec:.4f} | {f1:.4f} | {flagged:,} |")
report_lines.append("")

if y_test_ns.sum() > 0:
    auc_test_ns = roc_auc_score(y_test_ns, proba_test_ns)
    print(f"  AUC: {auc_test_ns:.4f} | Positives: {y_test_ns.sum()}")

report_lines.append("---")
report_lines.append("")

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Dataset Summary
# ═══════════════════════════════════════════════════════════════════════════════
report_lines.append("## 4. Dataset Summary")
report_lines.append("")
report_lines.append(f"| Property | Value |")
report_lines.append(f"|----------|-------|")
report_lines.append(f"| Total rows | {len(df):,} |")
report_lines.append(f"| Features engineered | {len(df.columns)} |")
report_lines.append(f"| Train rows (< 2020) | {len(df_train):,} |")
report_lines.append(f"| Test rows (≥ 2020) | {len(df_test):,} |")
report_lines.append(f"| Cancellation rate | {df['target_cancel'].mean():.3f} |")
report_lines.append(f"| No-show rate | {df['target_noshow'].mean():.4f} |")
report_lines.append(f"| Mean ADR | {df['adr'].mean():.2f} |")
report_lines.append(f"| City Hotel rows | {(df['hotel_encoded'] == 0).sum():,} |")
report_lines.append(f"| Resort Hotel rows | {(df['hotel_encoded'] == 1).sum():,} |")
report_lines.append("")

# ═══════════════════════════════════════════════════════════════════════════════
# Write report
# ═══════════════════════════════════════════════════════════════════════════════
with open(REPORT_FILE, 'w', encoding='utf-8') as f:
    f.write('\n'.join(report_lines))

print(f"\n{'='*60}")
print(f"[DONE] EVALUATION_REPORT.md written to {REPORT_FILE}")
print(f"{'='*60}")
