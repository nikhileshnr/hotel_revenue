const { QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');

async function findById(id) {
  const rows = await sequelize.query(
    'SELECT * FROM game_sessions WHERE id = ? LIMIT 1',
    { replacements: [id], type: QueryTypes.SELECT }
  );
  return rows[0] || undefined;
}

async function findByUser(userId) {
  const rows = await sequelize.query(
    'SELECT * FROM game_sessions WHERE user_id = ? ORDER BY created_at DESC',
    { replacements: [userId], type: QueryTypes.SELECT }
  );
  return rows;
}

async function insert(data) {
  const id = uuidv4();
  await sequelize.query(
    `INSERT INTO game_sessions (id, user_id, hotel_type, status, current_week, total_weeks, simulated_month, game_mode, created_at)
     VALUES (?, ?, ?, 'active', 0, ?, ?, ?, NOW())`,
    {
      replacements: [id, data.user_id, data.hotel_type, data.total_weeks || 20, data.simulated_month, data.game_mode || 'pricing'],
      type: QueryTypes.INSERT,
    }
  );
  return findById(id);
}

async function updateStatus(id, status, extraFields = {}) {
  const sets = ['status = ?'];
  const values = [status];

  for (const [key, val] of Object.entries(extraFields)) {
    sets.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);

  await sequelize.query(
    `UPDATE game_sessions SET ${sets.join(', ')} WHERE id = ?`,
    { replacements: values, type: QueryTypes.UPDATE }
  );
  return findById(id);
}

// Returns the single player for a session (the owner)
async function getPlayers(sessionId) {
  const session = await findById(sessionId);
  if (!session) return [];
  const rows = await sequelize.query(
    'SELECT id AS user_id, name, email FROM users WHERE id = ?',
    { replacements: [session.user_id], type: QueryTypes.SELECT }
  );
  return rows;
}

async function isPlayer(sessionId, userId) {
  const session = await findById(sessionId);
  return session && session.user_id === userId;
}

async function deleteById(id) {
  // Cascade delete related records
  await sequelize.query('DELETE FROM bookings WHERE session_id = ?', { replacements: [id], type: QueryTypes.DELETE });
  await sequelize.query('DELETE FROM weekly_scores WHERE session_id = ?', { replacements: [id], type: QueryTypes.DELETE });
  await sequelize.query('DELETE FROM player_states WHERE session_id = ?', { replacements: [id], type: QueryTypes.DELETE });
  await sequelize.query('DELETE FROM weeks WHERE session_id = ?', { replacements: [id], type: QueryTypes.DELETE });
  await sequelize.query('DELETE FROM game_sessions WHERE id = ?', { replacements: [id], type: QueryTypes.DELETE });
}

module.exports = {
  findById,
  findByUser,
  insert,
  updateStatus,
  getPlayers,
  isPlayer,
  deleteById,
};
