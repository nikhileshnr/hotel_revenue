const sessionRepository = require('../repositories/sessionRepository');
const playerStateRepository = require('../repositories/playerStateRepository');
const AppError = require('../utils/AppError');

async function validateAndStartGame(sessionId, requestingUserId) {
  const session = await sessionRepository.findById(sessionId);
  if (!session) throw new AppError('Session not found', 404);
  if (session.status !== 'active') throw new AppError('Session is not active', 400);

  // Ensure player_state exists
  const existing = await playerStateRepository.findOne(sessionId, requestingUserId);
  if (!existing) {
    await playerStateRepository.insert(sessionId, requestingUserId);
  }

  // Update session
  const updated = await sessionRepository.updateStatus(sessionId, 'active', {
    started_at: new Date(),
    current_week: 1,
  });

  return updated;
}

async function validateAndAdvanceWeek(sessionId, requestingUserId) {
  const session = await sessionRepository.findById(sessionId);
  if (!session) throw new AppError('Session not found', 404);
  if (session.status !== 'active') throw new AppError('Game is not active', 400);

  if (session.current_week < session.total_weeks) {
    const nextWeek = session.current_week + 1;
    await sessionRepository.updateStatus(sessionId, 'active', { current_week: nextWeek });
    const updated = await sessionRepository.findById(sessionId);
    return { isLast: false, nextWeek, session: updated };
  }

  return { isLast: true };
}

async function endGame(sessionId) {
  const updated = await sessionRepository.updateStatus(sessionId, 'completed', {
    completed_at: new Date(),
  });
  return updated;
}

module.exports = { validateAndStartGame, validateAndAdvanceWeek, endGame };
