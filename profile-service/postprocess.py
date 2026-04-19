"""
postprocess.py
Cleans raw CTGAN output and derives all fields needed by adr_predictor and risk_predictor.
"""

import random

# Lookup tables
SEGMENT_DISCOUNT = {
    'Direct': 0.10, 'Corporate': 0.15, 'Online TA': 0.30,
    'Offline TA/TO': 0.30, 'Groups': 0.10, 'Aviation': 0.20,
    'Complementary': 1.00
}

MEAL_COST = {
    'BB': 12.99, 'HB': 17.99, 'FB': 21.99,
    'SC': 35.00, 'Undefined': 0.00
}

VALID_MEALS = {'BB', 'HB', 'FB', 'SC', 'Undefined'}
VALID_SEGMENTS = {'Aviation', 'Complementary', 'Corporate', 'Direct', 'Groups', 'Offline TA/TO', 'Online TA'}
VALID_CUSTOMER_TYPES = {'Transient', 'Transient-Party', 'Contract', 'Group'}


def clean_and_derive(row, hotel_type: str, metadata: dict) -> dict:
    """
    Clean a raw CTGAN row and derive all fields needed for ADR and risk prediction.

    Args:
        row: pandas Series from CTGAN output
        hotel_type: 'city' or 'resort'
        metadata: ctgan_metadata.json dict

    Returns:
        Flat dict with all clamped and derived fields.
    """
    los_cap = metadata['los_cap'][hotel_type]

    # ─── Type clamping ─────────────────────────────────────────────────────
    los = max(1, min(int(round(float(row.get('los', 1)))), los_cap))
    total_guests = max(1, min(int(round(float(row.get('total_guests', 1)))), 10))
    room_tier = max(1, min(int(round(float(row.get('room_tier', 1)))), 4))
    is_repeated_guest = 1 if float(row.get('is_repeated_guest', 0)) >= 0.5 else 0
    # CTGAN over-represents is_repeated_guest (8.5% synthetic vs 2.9% real).
    # Correction: if CTGAN says repeated, 66% chance we flip it back to 0.
    # This brings the effective rate from ~8.5% down to ~2.9%.
    if is_repeated_guest == 1 and random.random() > 0.34:
        is_repeated_guest = 0
    has_special_requests = 1 if float(row.get('has_special_requests', 0)) >= 0.5 else 0
    is_non_refund = 1 if float(row.get('is_non_refund', 0)) >= 0.5 else 0
    previous_cancellations = max(0, min(int(round(float(row.get('previous_cancellations', 0)))), 10))
    lead_time_bucket = max(0, min(int(round(float(row.get('lead_time_bucket', 0)))), 5))

    # Categorical clamping
    meal = str(row.get('meal', 'BB'))
    if meal not in VALID_MEALS:
        meal = 'BB'

    market_segment = str(row.get('market_segment', 'Online TA'))
    if market_segment not in VALID_SEGMENTS:
        market_segment = 'Online TA'

    customer_type = str(row.get('customer_type', 'Transient'))
    if customer_type not in VALID_CUSTOMER_TYPES:
        customer_type = 'Transient'

    hotel_encoded = max(0, min(int(round(float(row.get('hotel_encoded', 0)))), 1))
    month_num = max(1, min(int(round(float(row.get('month_num', 1)))), 12))

    # ─── Derived fields ────────────────────────────────────────────────────
    deposit_type = 'Non Refund' if is_non_refund == 1 else 'No Deposit'
    has_prev_cancellations = 1 if previous_cancellations > 0 else 0
    loyalty_score = min(int(previous_cancellations), 20)
    segment_discount = SEGMENT_DISCOUNT.get(market_segment, 0.0)
    meal_cost = MEAL_COST.get(meal, 0.0)
    is_weekend_arrival = 1 if random.random() < (2.0 / 7.0) else 0

    # Integer encoding (must match training exactly)
    seg_encoding = metadata.get('market_segment_encoding', {})
    cust_encoding = metadata.get('customer_type_encoding', {})
    market_segment_encoded = seg_encoding.get(market_segment, 0)
    customer_type_encoded = cust_encoding.get(customer_type, 0)

    # Compute is_summer and lead_time from bucket
    is_summer = 1 if month_num in (6, 7, 8) else 0

    # Map lead_time_bucket back to approximate lead_time for cancel model
    # Buckets: 0=0, 1=1-7, 2=8-30, 3=31-90, 4=91-200, 5=200+
    lead_time_midpoints = {0: 0, 1: 4, 2: 15, 3: 60, 4: 145, 5: 250}
    lead_time = lead_time_midpoints.get(lead_time_bucket, 0)

    # Room type from tier (for guest object)
    tier_to_room = {1: 'A', 2: 'D', 3: 'E', 4: 'G'}
    room_type = tier_to_room.get(room_tier, 'A')

    return {
        'hotel_encoded': hotel_encoded,
        'month_num': month_num,
        'room_tier': room_tier,
        'room_type': room_type,
        'los': los,
        'meal': meal,
        'market_segment': market_segment,
        'customer_type': customer_type,
        'total_guests': total_guests,
        'is_repeated_guest': is_repeated_guest,
        'has_special_requests': has_special_requests,
        'is_non_refund': is_non_refund,
        'previous_cancellations': previous_cancellations,
        'lead_time_bucket': lead_time_bucket,
        'deposit_type': deposit_type,
        'has_prev_cancellations': has_prev_cancellations,
        'loyalty_score': loyalty_score,
        'segment_discount': segment_discount,
        'meal_cost': meal_cost,
        'is_weekend_arrival': is_weekend_arrival,
        'market_segment_encoded': market_segment_encoded,
        'customer_type_encoded': customer_type_encoded,
        'is_summer': is_summer,
        'lead_time': lead_time,
        # Fields needed for booking_changes / days_in_waiting_list
        # (not generated by CTGAN, default to 0)
        'booking_changes': 0,
        'days_in_waiting_list': 0,
    }
