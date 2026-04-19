"""
generator.py
Loads CTGAN model at startup. Exposes generate() for sampling conditioned profiles.
"""

import os
import json
import pandas as pd
from sdv.single_table import CTGANSynthesizer

_synthesizer = None
_metadata = None


def init():
    """Load CTGAN model and metadata at startup."""
    global _synthesizer, _metadata

    models_dir = os.environ.get('MODELS_DIR', '../demand_model/models')

    # Load metadata
    metadata_path = os.path.join(models_dir, 'ctgan_metadata.json')
    if not os.path.exists(metadata_path):
        raise FileNotFoundError(f"CTGAN metadata not found: {metadata_path}")
    with open(metadata_path, 'r') as f:
        _metadata = json.load(f)
    print(f"[generator] Loaded ctgan_metadata.json — trained {_metadata['trained_date']}, {_metadata['training_rows']} rows")

    # Load synthesizer — patch torch.load for GPU→CPU compatibility
    model_path = os.path.join(models_dir, 'ctgan_model.pkl')
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"CTGAN model not found: {model_path}")

    # Models trained on Colab GPU need map_location='cpu' for local CPU loading
    import torch
    _original_torch_load = torch.load
    torch.load = lambda *args, **kwargs: _original_torch_load(
        *args, **{**kwargs, 'map_location': torch.device('cpu'), 'weights_only': False}
    )
    try:
        _synthesizer = CTGANSynthesizer.load(model_path)
    finally:
        torch.load = _original_torch_load  # restore original
    print(f"[generator] Loaded ctgan_model.pkl")


def get_metadata() -> dict:
    """Return the loaded metadata dict."""
    if _metadata is None:
        raise RuntimeError("generator.init() not called")
    return _metadata


def generate(hotel_encoded: int, month_num: int, n: int) -> pd.DataFrame:
    """
    Generate n conditioned guest profiles.
    Returns a raw DataFrame — no postprocessing applied.
    """
    if _synthesizer is None:
        raise RuntimeError("generator.init() not called")

    # Build condition dataframe for sample_remaining_columns
    condition_df = pd.DataFrame({
        'hotel_encoded': [hotel_encoded] * n,
        'month_num': [month_num] * n
    })

    try:
        result = _synthesizer.sample_remaining_columns(condition_df)
    except Exception:
        # Fallback: sample unconditionally and filter
        raw = _synthesizer.sample(num_rows=n * 10)
        result = raw[
            (raw['hotel_encoded'].round() == hotel_encoded) &
            (raw['month_num'].round() == month_num)
        ].head(n)

    # If fewer than n rows (rare), pad with unconditional samples
    if len(result) < n:
        extra = _synthesizer.sample(num_rows=n - len(result))
        result = pd.concat([result, extra], ignore_index=True)

    return result.head(n)

