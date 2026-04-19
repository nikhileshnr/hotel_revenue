"""
risk_predictor.py
Loads cancel and noshow models at startup. Predicts risk for guest profiles (single + batch).
"""

import os
import json
import numpy as np
import joblib

_cancel_model = None
_noshow_model = None
_config = None


def init():
    """Load risk models and pipeline config at startup."""
    global _cancel_model, _noshow_model, _config

    models_dir = os.environ.get('MODELS_DIR', '../demand_model/models')

    # Load pipeline config
    config_path = os.path.join(models_dir, 'pipeline_config.json')
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"pipeline_config.json not found: {config_path}")
    with open(config_path, 'r') as f:
        _config = json.load(f)

    # Load cancel model (CalibratedClassifierCV — Platt scaling baked in)
    cancel_path = os.path.join(models_dir, 'cancel_model.pkl')
    if not os.path.exists(cancel_path):
        raise FileNotFoundError(f"Cancel model not found: {cancel_path}")
    _cancel_model = joblib.load(cancel_path)
    print(f"[risk_predictor] Loaded cancel_model.pkl (CalibratedClassifierCV)")

    # Load noshow model
    noshow_path = os.path.join(models_dir, 'noshow_model.pkl')
    if not os.path.exists(noshow_path):
        raise FileNotFoundError(f"Noshow model not found: {noshow_path}")
    _noshow_model = joblib.load(noshow_path)
    print(f"[risk_predictor] Loaded noshow_model.pkl")


def predict_risk(profile: dict) -> dict:
    """Predict risk for a single guest profile."""
    return predict_risk_batch([profile])[0]


def predict_risk_batch(profiles: list) -> list:
    """
    Batch-predict cancellation and no-show risk for all profiles at once.
    Uses single predict_proba() calls instead of N individual calls.
    """
    if _config is None:
        raise RuntimeError("risk_predictor.init() not called")
    if not profiles:
        return []

    thresholds = _config['risk_badge_thresholds']
    cancel_feature_order = _config['cancel_feature_order']
    noshow_feature_order = _config['noshow_feature_order']

    # Build cancel feature matrix (N x 15)
    X_cancel = np.array([
        [float(p.get(f, 0)) for f in cancel_feature_order]
        for p in profiles
    ], dtype=np.float64)

    # Build noshow feature matrix (N x 6)
    X_noshow = np.array([
        [float(p.get(f, 0)) for f in noshow_feature_order]
        for p in profiles
    ], dtype=np.float64)

    # Single batch prediction calls
    p_cancel_all = _cancel_model.predict_proba(X_cancel)[:, 1]
    p_noshow_all = _noshow_model.predict_proba(X_noshow)[:, 1]

    # Assign badges
    results = []
    for i in range(len(profiles)):
        p_cancel = float(p_cancel_all[i])
        p_noshow = float(p_noshow_all[i])

        if p_cancel < thresholds['low']:
            risk_badge = 'green'
        elif p_cancel >= thresholds['high']:
            risk_badge = 'red'
        else:
            risk_badge = 'yellow'

        results.append({
            'p_cancel': round(p_cancel, 4),
            'p_noshow': round(p_noshow, 4),
            'risk_badge': risk_badge
        })

    return results
