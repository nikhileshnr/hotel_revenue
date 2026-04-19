const ort = require('onnxruntime-node');
const { getAdrSession, getConfig } = require('./modelLoader');
const { HOTEL_KEY, randn } = require('./profileSampler');

async function predictRevenue(hotelType, profile) {
  const config = getConfig();
  const hotelKey = HOTEL_KEY[hotelType];
  const session = getAdrSession(hotelType);

  // Build feature vector in exact order from pipeline_config.adr_feature_order
  const featureValues = config.adr_feature_order.map((feature) => {
    switch (feature) {
      case 'hotel_encoded':         return profile.hotel_encoded;
      case 'room_tier':             return profile.room_tier;
      case 'month_num':             return profile.month_num;
      case 'is_summer':             return profile.is_summer;
      case 'is_weekend_arrival':    return profile.is_weekend_arrival;
      case 'los':                   return profile.los;
      case 'total_guests':          return profile.total_guests;
      case 'has_special_requests':  return profile.has_special_requests;
      case 'is_repeated_guest':     return profile.is_repeated_guest;
      case 'is_non_refund':         return profile.is_non_refund;
      case 'lead_time_bucket':      return profile.lead_time_bucket;
      case 'market_segment_encoded': return profile.market_segment_encoded;
      case 'customer_type_encoded': return profile.customer_type_encoded;
      default:
        console.warn(`[ADR] Unknown feature: ${feature}`);
        return 0;
    }
  });

  // Create ONNX tensor — Float32Array with shape [1, N]
  const inputTensor = new ort.Tensor('float32', Float32Array.from(featureValues), [1, featureValues.length]);

  // Run inference
  const inputName = session.inputNames[0];
  const results = await session.run({ [inputName]: inputTensor });

  // Extract predicted ADR
  const outputName = session.outputNames[0];
  let adrHat = results[outputName].data[0];

  // Apply Gaussian noise
  const noiseStd = config.adr_noise_std[hotelKey] || 22;
  const adrFinal = Math.max(0, adrHat + noiseStd * randn());

  // Compute revenue — segment discount applies ONLY to room rate, never to meal cost
  const net_adr = adrFinal * (1 - profile.segment_discount);
  const room_revenue = net_adr * profile.los;
  const meal_revenue = profile.meal_cost * profile.los;
  const revenue_offered = parseFloat((room_revenue + meal_revenue).toFixed(2));

  return {
    adr_predicted: parseFloat(adrFinal.toFixed(2)),
    revenue_offered: Math.max(0, revenue_offered),
  };
}

module.exports = { predictRevenue };
