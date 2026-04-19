const { QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');

async function findBySession(sessionId) {
  const rows = await sequelize.query(
    'SELECT * FROM player_states WHERE session_id = ?',
    { replacements: [sessionId], type: QueryTypes.SELECT }
  );
  return rows;
}

async function findOne(sessionId, userId) {
  const rows = await sequelize.query(
    'SELECT * FROM player_states WHERE session_id = ? AND user_id = ? LIMIT 1',
    { replacements: [sessionId, userId], type: QueryTypes.SELECT }
  );
  return rows[0] || undefined;
}

async function insert(sessionId, userId) {
  const id = uuidv4();
  await sequelize.query(
    'INSERT INTO player_states (id, session_id, user_id, total_revenue, updated_at) VALUES (?, ?, ?, 0, NOW())',
    { replacements: [id, sessionId, userId], type: QueryTypes.INSERT }
  );
  return { id, session_id: sessionId, user_id: userId, total_revenue: 0 };
}

async function incrementRevenue(sessionId, userId, amount) {
  await sequelize.query(
    'UPDATE player_states SET total_revenue = total_revenue + ?, updated_at = NOW() WHERE session_id = ? AND user_id = ?',
    { replacements: [amount, sessionId, userId], type: QueryTypes.UPDATE }
  );
}

module.exports = { findBySession, findOne, insert, incrementRevenue };
