const { QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');

async function findById(id) {
  const rows = await sequelize.query(
    'SELECT * FROM weeks WHERE id = ? LIMIT 1',
    { replacements: [id], type: QueryTypes.SELECT }
  );
  return rows[0] || undefined;
}

async function findActive(sessionId) {
  const rows = await sequelize.query(
    "SELECT * FROM weeks WHERE session_id = ? AND status = 'active' LIMIT 1",
    { replacements: [sessionId], type: QueryTypes.SELECT }
  );
  return rows[0] || undefined;
}

async function findByNumber(sessionId, weekNumber) {
  const rows = await sequelize.query(
    'SELECT * FROM weeks WHERE session_id = ? AND week_number = ? LIMIT 1',
    { replacements: [sessionId, weekNumber], type: QueryTypes.SELECT }
  );
  return rows[0] || undefined;
}

async function insert({ session_id, week_number, simulated_month, guests_json, guest_count }) {
  const id = uuidv4();
  await sequelize.query(
    `INSERT INTO weeks (id, session_id, week_number, status, simulated_month, guest_count, guests_json, started_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, NOW())`,
    {
      replacements: [id, session_id, week_number, simulated_month, guest_count, JSON.stringify(guests_json)],
      type: QueryTypes.INSERT,
    }
  );
  return findById(id);
}

async function updateStatus(weekId, status, extraFields = {}) {
  const sets = ['status = ?'];
  const values = [status];

  for (const [key, val] of Object.entries(extraFields)) {
    sets.push(`${key} = ?`);
    values.push(val);
  }
  values.push(weekId);

  await sequelize.query(
    `UPDATE weeks SET ${sets.join(', ')} WHERE id = ?`,
    { replacements: values, type: QueryTypes.UPDATE }
  );
}

async function findAllBySession(sessionId) {
  return sequelize.query(
    'SELECT * FROM weeks WHERE session_id = ? ORDER BY week_number ASC',
    { replacements: [sessionId], type: QueryTypes.SELECT }
  );
}

module.exports = { findById, findActive, findByNumber, findAllBySession, insert, updateStatus };
