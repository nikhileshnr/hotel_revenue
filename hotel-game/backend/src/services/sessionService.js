const sessionRepository = require('../repositories/sessionRepository');
const playerStateRepository = require('../repositories/playerStateRepository');
const redis = require('../config/redis');
const AppError = require('../utils/AppError');

async function createSession({ userId, hotel_type, total_weeks, segments, game_mode }) {
  if (!['city', 'resort'].includes(hotel_type)) {
    throw new AppError('hotel_type must be city or resort', 400);
  }

  const validModes = ['pricing', 'classic'];
  const mode = validModes.includes(game_mode) ? game_mode : 'pricing';

  const simulated_month = Math.floor(Math.random() * 12) + 1;

  const session = await sessionRepository.insert({
    user_id: userId,
    hotel_type,
    total_weeks: total_weeks || 20,
    simulated_month,
    game_mode: mode,
  });

  // Store segment config in Redis (default: all enabled)
  if (segments && typeof segments === 'object') {
    await redis.set(`session:${session.id}:segments`, JSON.stringify(segments), 'EX', 86400);
  }

  // Auto-create player state for the owner
  await playerStateRepository.insert(session.id, userId);

  return session;
}

async function getSession(sessionId, requestingUserId) {
  const session = await sessionRepository.findById(sessionId);
  if (!session) throw new AppError('Session not found', 404);

  if (session.user_id !== requestingUserId) {
    throw new AppError('Not authorized to view this session', 403);
  }

  return session;
}

async function getMySessions(userId) {
  return sessionRepository.findByUser(userId);
}

async function deleteSession(sessionId, requestingUserId) {
  const session = await sessionRepository.findById(sessionId);
  if (!session) throw new AppError('Session not found', 404);
  if (session.user_id !== requestingUserId) {
    throw new AppError('Not authorized to delete this session', 403);
  }
  await sessionRepository.deleteById(sessionId);
}

module.exports = { createSession, getSession, getMySessions, deleteSession };
