# Model Evaluation Report

**Generated:** 2026-04-18 02:25
**Dataset:** `df_featured.csv` (226,999 rows)
**Split:** Temporal — Train < 2020-01-01, Test ≥ 2020-01-01
**Train size:** 219,199 rows | **Test size:** 7,800 rows

---

## 1. ADR (Average Daily Rate) — Regression

### 1.a. City Hotel

**Training set:** 83,809 Check-Out rows
**Test set:** 2,920 Check-Out rows

| Metric | Train | Test |
|--------|-------|------|
| RMSE | 20.16 | 17.48 |
| MAE | 13.95 | 11.95 |
| R² | 0.7216 | 0.6409 |
| MAPE | — | 50.6% |

**Residual Analysis (test):** Mean = 3.92, Std = 17.03

**Feature Importance (top 5):**

| Rank | Feature | Importance |
|------|---------|------------|
| 1 | `month_num` | 6287 |
| 2 | `los` | 5187 |
| 3 | `lead_time_bucket` | 4885 |
| 4 | `market_segment_encoded` | 4040 |
| 5 | `total_guests` | 2774 |

**Prediction Distribution (test):**

| Stat | Actual ADR | Predicted ADR |
|------|-----------|--------------|
| Mean | 89.40 | 85.48 |
| Median | 85.00 | 80.52 |
| Std | 29.17 | 23.35 |
| Min | 0.00 | -5.54 |
| Max | 240.80 | 229.73 |

### 1.b. Resort Hotel

**Training set:** 54,232 Check-Out rows
**Test set:** 2,274 Check-Out rows

| Metric | Train | Test |
|--------|-------|------|
| RMSE | 20.79 | 12.99 |
| MAE | 13.84 | 8.48 |
| R² | 0.8630 | 0.6142 |
| MAPE | — | 61.6% |

**Residual Analysis (test):** Mean = 1.65, Std = 12.89

**Feature Importance (top 5):**

| Rank | Feature | Importance |
|------|---------|------------|
| 1 | `los` | 19270 |
| 2 | `month_num` | 18429 |
| 3 | `lead_time_bucket` | 15316 |
| 4 | `room_tier` | 11084 |
| 5 | `market_segment_encoded` | 10540 |

**Prediction Distribution (test):**

| Stat | Actual ADR | Predicted ADR |
|------|-----------|--------------|
| Mean | 54.47 | 52.82 |
| Median | 48.00 | 50.87 |
| Std | 20.92 | 15.79 |
| Min | 0.00 | -9.96 |
| Max | 165.00 | 125.62 |

---

## 2. Cancellation — Binary Classification

**Model:** LightGBM + CalibratedClassifierCV (Platt scaling)
**Features:** 15
**Class balance (train):** 0.371 positive rate
**Class balance (test):** 0.334 positive rate

### Train Set Summary
- **AUC-ROC:** 0.9237
- **Accuracy:** 0.8529

### Test Set (Full Evaluation)

**Accuracy:** 0.8122
**AUC-ROC:** 0.8865
**AUC-PR (Average Precision):** 0.8263
**Brier Score:** 0.1247

**Confusion Matrix:**

|              | Pred No Cancel |    Pred Cancel |
|--------------|----------------|----------------|
| True No Cancel |          4,582 |            612 |
|  True Cancel |            853 |          1,753 |

**Classification Report:**
```
precision    recall  f1-score   support

   No Cancel     0.8431    0.8822    0.8622      5194
      Cancel     0.7412    0.6727    0.7053      2606

    accuracy                         0.8122      7800
   macro avg     0.7921    0.7774    0.7837      7800
weighted avg     0.8090    0.8122    0.8098      7800
```

### Calibration (Reliability Diagram)

| Bin | Predicted | Actual | Count | Gap |
|-----|-----------|--------|-------|-----|
| 0.0–0.1 | 0.0605 | 0.0413 | 2,640 | 0.0192 |
| 0.1–0.2 | 0.1442 | 0.1406 |   903 | 0.0035 |
| 0.2–0.3 | 0.2532 | 0.2321 |   840 | 0.0210 |
| 0.3–0.4 | 0.3461 | 0.3579 |   651 | 0.0118 |
| 0.4–0.5 | 0.4501 | 0.4713 |   401 | 0.0212 |
| 0.5–0.6 | 0.5462 | 0.4711 |   484 | 0.0751 |
| 0.6–0.7 | 0.6541 | 0.6043 |   508 | 0.0498 |
| 0.7–0.8 | 0.7445 | 0.7282 |   515 | 0.0163 |
| 0.8–0.9 | 0.8384 | 0.8557 |    97 | 0.0173 |
| 0.9–1.0 | 0.9314 | 0.9987 |   761 | 0.0673 |

### Risk Badge Distribution (test set)

| Badge | Count | % | Actual Cancel Rate |
|-------|-------|---|-------------------|
| 🟢 Green (<0.25) | 3,906 | 50.1% | 0.078 |
| 🟡 Yellow (0.25–0.55) | 1,832 | 23.5% | 0.383 |
| 🔴 Red (≥0.55) | 2,062 | 26.4% | 0.777 |

### Overfit Check

| Metric | Train | Test | Gap |
|--------|-------|------|-----|
| AUC-ROC | 0.9237 | 0.8865 | 0.0372 |
| Accuracy | 0.8529 | 0.8122 | 0.0407 |

---

## 3. No-Show — Binary Classification

**Model:** LightGBM (raw, no calibration)
**Features:** 6
**Class balance (train):** 0.0105 positive rate (2,302 positives)
**Class balance (test):** 0.0138 positive rate (108 positives)

> [!NOTE]
> No-show is a rare event (~1% positive rate). Standard accuracy is misleading.
> Focus on AUC-PR and recall for the positive class.

### Train Set Summary
- **AUC-ROC:** 0.8911

### Test Set (Full Evaluation)

**Accuracy:** 0.5903
**AUC-ROC:** 0.8224
**AUC-PR (Average Precision):** 0.1423
**Brier Score:** 0.2385

**Confusion Matrix:**

|              |      Pred Show |   Pred No-Show |
|--------------|----------------|----------------|
|    True Show |          4,514 |          3,178 |
| True No-Show |             18 |             90 |

**Classification Report:**
```
precision    recall  f1-score   support

        Show     0.9960    0.5868    0.7385      7692
     No-Show     0.0275    0.8333    0.0533       108

    accuracy                         0.5903      7800
   macro avg     0.5118    0.7101    0.3959      7800
weighted avg     0.9826    0.5903    0.7291      7800
```

### Threshold Analysis (No-Show)

| Threshold | Precision | Recall | F1 | Flagged |
|-----------|-----------|--------|-----|---------|
| 0.02 | 0.0175 | 1.0000 | 0.0343 | 6,187 |
| 0.05 | 0.0192 | 1.0000 | 0.0377 | 5,627 |
| 0.10 | 0.0200 | 1.0000 | 0.0392 | 5,397 |
| 0.20 | 0.0233 | 1.0000 | 0.0455 | 4,636 |
| 0.50 | 0.0275 | 0.8333 | 0.0533 | 3,268 |

---

## 4. Dataset Summary

| Property | Value |
|----------|-------|
| Total rows | 226,999 |
| Features engineered | 55 |
| Train rows (< 2020) | 219,199 |
| Test rows (≥ 2020) | 7,800 |
| Cancellation rate | 0.369 |
| No-show rate | 0.0106 |
| Mean ADR | 97.62 |
| City Hotel rows | 149,218 |
| Resort Hotel rows | 77,781 |
