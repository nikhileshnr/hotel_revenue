const path = require('path');

const MODELS_DIR = path.resolve(__dirname, '../../models');

// ─── ONNX sessions kept for statistical fallback only ────────────────────────
// When the Python profile-service is available, these are not used.
// If you remove the fallback, you can delete all ONNX-related code below.
let adrSessions = {};
let cancelSession = null;
let noshowSession = null;

let volumeParams = null;
let profileParams = null;
let pipelineConfig = null;

async function loadAllModels() {
  console.log('[ModelLoader] Loading model artifacts...');

  // Load JSON files (always needed)
  volumeParams = require(path.join(MODELS_DIR, 'volume_params.json'));
  profileParams = require(path.join(MODELS_DIR, 'profile_params.json'));
  pipelineConfig = require(path.join(MODELS_DIR, 'pipeline_config.json'));

  // Log model version
  const MIN_MODEL_VERSION = '1.0.0';
  if (pipelineConfig.model_version) {
    console.log(`[ModelLoader] Model version: ${pipelineConfig.model_version} (trained: ${pipelineConfig.trained_date || 'unknown'})`);
    if (pipelineConfig.model_version < MIN_MODEL_VERSION) {
      throw new Error(`[ModelLoader] Model version ${pipelineConfig.model_version} is below minimum ${MIN_MODEL_VERSION}. Please retrain models.`);
    }
  } else {
    console.warn('[ModelLoader] Warning: pipeline_config.json has no model_version field');
  }

  // ─── ONNX fallback loading (only if files exist) ──────────────────────
  // Primary inference is via Python profile-service. ONNX is fallback only.
  try {
    const ort = require('onnxruntime-node');
    adrSessions = {
      city: await ort.InferenceSession.create(
        path.join(MODELS_DIR, 'adr_model_city.onnx')
      ),
      resort: await ort.InferenceSession.create(
        path.join(MODELS_DIR, 'adr_model_resort.onnx')
      ),
    };

    cancelSession = await ort.InferenceSession.create(
      path.join(MODELS_DIR, 'cancel_model.onnx')
    );

    noshowSession = await ort.InferenceSession.create(
      path.join(MODELS_DIR, 'noshow_model.onnx')
    );

    console.log('[ModelLoader] ONNX fallback models loaded (used when Python service unavailable)');
  } catch (err) {
    console.warn(`[ModelLoader] ONNX fallback not available: ${err.message}`);
    console.warn('[ModelLoader] Statistical fallback will not work without ONNX models');
  }

  console.log('[ModelLoader] All models loaded successfully');
}

function getAdrSession(hotelType) {
  return adrSessions[hotelType];
}
function getCancelSession() {
  return cancelSession;
}
function getNoshowSession() {
  return noshowSession;
}
function getVolumeParams() {
  return volumeParams;
}
function getProfileParams() {
  return profileParams;
}
function getConfig() {
  return pipelineConfig;
}

module.exports = {
  loadAllModels,
  getAdrSession,
  getCancelSession,
  getNoshowSession,
  getVolumeParams,
  getProfileParams,
  getConfig,
};
