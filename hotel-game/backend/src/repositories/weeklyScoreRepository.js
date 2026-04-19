const { QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');

async function insert(data) {
  const id = uuidv4();
  const columns = ['id'];
  const placeholders = ['?'];
  const values = [id];

  for (const [key, val] of Object.entries(data)) {
    columns.push(key);
    placeholders.push('?');
    values.push(val);
  }

  await sequelize.query(
    `INSERT INTO weekly_scores (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    { replacements: values, type: QueryTypes.INSERT }
  );
  return { id, ...data };
}

async function findBySession(sessionId) {
  const rows = await sequelize.query(
    'SELECT * FROM weekly_scores WHERE session_id = ? ORDER BY created_at ASC',
    { replacements: [sessionId], type: QueryTypes.SELECT }
  );
  return rows;
}

async function findByPlayerOrdered(sessionId, userId) {
  const rows = await sequelize.query(
    'SELECT * FROM weekly_scores WHERE session_id = ? AND user_id = ? ORDER BY created_at ASC',
    { replacements: [sessionId, userId], type: QueryTypes.SELECT }
  );
  return rows;
}

async function getHistory(sessionId, userId) {
  const rows = await sequelize.query(
    `SELECT ws.*, w.week_number,
       RANK() OVER (PARTITION BY ws.week_id ORDER BY ws.cumulative_revenue DESC) as week_rank
     FROM weekly_scores ws
     INNER JOIN weeks w ON w.id = ws.week_id
     WHERE ws.session_id = ? AND ws.user_id = ?
     ORDER BY w.week_number ASC`,
    { replacements: [sessionId, userId], type: QueryTypes.SELECT }
  );
  return rows;
}

module.exports = { insert, findBySession, findByPlayerOrdered, getHistory };
