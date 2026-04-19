"""
adr_predictor.py
Loads ADR models at startup. Predicts revenue for guest profiles (single + batch).
"""

import os
import json
import random
import numpy as np
import joblib

_models = {}
_config = None


def init():
    """Load ADR models and pipeline config at startup."""
    global _models, _config

    models_dir = os.environ.get('MODELS_DIR', '../demand_model/models')

    # Load pipeline config
    config_path = os.path.join(models_dir, 'pipeline_config.json')
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"pipeline_config.json not found: {config_path}")
    with open(config_path, 'r') as f:
        _config = json.load(f)

    # Load ADR models
    for hotel_key, filename in [('city', 'adr_model_city.pkl'), ('resort', 'adr_model_resort.pkl')]:
        pkl_path = os.path.join(models_dir, filename)
        if not os.path.exists(pkl_path):
            raise FileNotFoundError(f"ADR model not found: {pkl_path}")
        _models[hotel_key] = joblib.load(pkl_path)
        print(f"[adr_predictor] Loaded {filename}")

    print(f"[adr_predictor] ADR noise std: {_config['adr_noise_std']}")


def predict_revenue(hotel_type: str, profile: dict) -> dict:
    """Predict ADR and compute revenue for a single guest profile."""
    return predict_revenue_batch(hotel_type, [profile])[0]


def predict_revenue_batch(hotel_type: str, profiles: list) -> list:
    """
    Batch-predict ADR and compute revenue for all profiles at once.
    Uses a single model.predict() call instead of N individual calls.
    """
    if _config is None:
        raise RuntimeError("adr_predictor.init() not called")
    if not profiles:
        return []

    model = _models[hotel_type]
    hotel_type_full = 'City Hotel' if hotel_type == 'city' else 'Resort Hotel'
    feature_order = _config['adr_feature_order']
    noise_std = _config['adr_noise_std'][hotel_type_full]

    # Build feature matrix (N x F) — single numpy array
    X = np.array([
        [float(p.get(f, 0)) for f in feature_order]
        for p in profiles
    ], dtype=np.float64)

    # Single batch prediction call
    adr_preds = model.predict(X)

    # Vectorized noise + revenue computation
    noise = np.random.normal(0, noise_std, size=len(profiles))
    adr_final = np.maximum(0, adr_preds + noise)

    results = []
    for i, p in enumerate(profiles):
        segment_discount = p.get('segment_discount', 0.0)
        los = p.get('los', 1)
        meal_cost = p.get('meal_cost', 0.0)

        net_adr = adr_final[i] * (1 - segment_discount)
        revenue_offered = round(net_adr * los + meal_cost * los, 2)

        results.append({
            'adr_predicted': round(float(adr_final[i]), 2),
            'revenue_offered': revenue_offered
        })

    return results
