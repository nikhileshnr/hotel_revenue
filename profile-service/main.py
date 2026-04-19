"""
main.py
FastAPI microservice for guest profile generation.
Orchestrates CTGAN generation, postprocessing, ADR prediction, and risk prediction.
"""

import os
import random
import warnings
from contextlib import asynccontextmanager

# Silence sklearn warnings about feature names (harmless — numpy arrays vs pandas DataFrames)
warnings.filterwarnings('ignore', message='.*does not have valid feature names.*', category=UserWarning)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv

import generator
import adr_predictor
import risk_predictor
import postprocess

load_dotenv()

# Segment label mapping (same as Node.js guestFactory.js)
SEGMENT_LABELS = {
    'Direct': 'High Margin',
    'Corporate': 'Reliable',
    'Online TA': 'High Volume',
    'Offline TA/TO': 'High Volume',
    'Groups': 'High Risk',
    'Aviation': 'Discounted',
    'Complementary': 'No Revenue'
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize all models at startup. If any fails, service exits."""
    print("[startup] Initializing models...")
    generator.init()
    adr_predictor.init()
    risk_predictor.init()
    print("[startup] All models loaded successfully")
    yield
    print("[shutdown] Service shutting down")


app = FastAPI(
    title="Hotel Guest Profile Service",
    description="CTGAN + LightGBM inference for hotel revenue management game",
    version="1.2.0",
    lifespan=lifespan
)


class GenerateRequest(BaseModel):
    hotel_type: str = Field(..., description="'city' or 'resort'")
    month_num: int = Field(..., ge=1, le=12, description="Month number 1-12")
    n: int = Field(..., ge=1, le=500, description="Number of guests to generate")


@app.post("/generate-guests")
async def generate_guests(req: GenerateRequest):
    """Generate N complete guest profiles with ADR and risk predictions."""
    # Validate hotel_type
    if req.hotel_type not in ('city', 'resort'):
        raise HTTPException(status_code=422, detail="hotel_type must be 'city' or 'resort'")

    hotel_encoded = 0 if req.hotel_type == 'city' else 1
    metadata = generator.get_metadata()

    # 1. Generate raw profiles via CTGAN
    raw_df = generator.generate(hotel_encoded, req.month_num, req.n)

    # 2. Postprocess all rows (cheap — no ML, pure python logic)
    profiles = []
    for _, row in raw_df.iterrows():
        profiles.append(postprocess.clean_and_derive(row, req.hotel_type, metadata))

    # 3. Batch-predict ADR for all profiles at once
    adr_results = adr_predictor.predict_revenue_batch(req.hotel_type, profiles)

    # 4. Batch-predict risk for all profiles at once
    risk_results = risk_predictor.predict_risk_batch(profiles)

    # 5. Assemble final guest objects
    guests = []
    for idx, (profile, adr, risk) in enumerate(zip(profiles, adr_results, risk_results)):
        profile.update(adr)
        profile.update(risk)
        profile['index'] = idx
        profile['arrival_day'] = random.randint(1, 7)
        profile['expected_value'] = round(
            profile['revenue_offered'] * (1 - profile['p_cancel']), 2
        )
        profile['segment_label'] = SEGMENT_LABELS.get(
            profile['market_segment'], 'Unknown'
        )
        guests.append(profile)

    return {
        "guests": guests,
        "count": len(guests),
        "source": "ctgan"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    try:
        metadata = generator.get_metadata()
        return {
            "status": "ok",
            "model_version": "1.2.0",
            "ctgan_trained_date": metadata.get('trained_date', 'unknown'),
            "training_rows": metadata.get('training_rows', 0)
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
