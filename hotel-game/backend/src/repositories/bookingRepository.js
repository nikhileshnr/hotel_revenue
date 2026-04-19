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
    `INSERT INTO bookings (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    { replacements: values, type: QueryTypes.INSERT }
  );
  return { id, ...data };
}

async function findAccepted(weekId) {
  const rows = await sequelize.query(
    "SELECT * FROM bookings WHERE week_id = ? AND decision = 'accepted'",
    { replacements: [weekId], type: QueryTypes.SELECT }
  );
  return rows;
}

async function findByPlayer(weekId, userId) {
  const rows = await sequelize.query(
    'SELECT * FROM bookings WHERE week_id = ? AND user_id = ?',
    { replacements: [weekId, userId], type: QueryTypes.SELECT }
  );
  return rows;
}

async function updateOutcome(bookingId, { outcome, revenue_realized, resolved_at }) {
  await sequelize.query(
    'UPDATE bookings SET outcome = ?, revenue_realized = ?, resolved_at = ? WHERE id = ?',
    { replacements: [outcome, revenue_realized, resolved_at, bookingId], type: QueryTypes.UPDATE }
  );
}

async function getWeekBreakdown(weekId, userId) {
  const rows = await sequelize.query(
    'SELECT * FROM bookings WHERE week_id = ? AND user_id = ? ORDER BY guest_index ASC',
    { replacements: [weekId, userId], type: QueryTypes.SELECT }
  );
  return rows;
}

async function countByPlayerAndWeek(weekId, userId) {
  const rows = await sequelize.query(
    `SELECT 
       SUM(CASE WHEN decision = 'rejected' THEN 1 ELSE 0 END) AS rejected,
       SUM(CASE WHEN decision = 'timeout' THEN 1 ELSE 0 END) AS timed_out
     FROM bookings WHERE week_id = ? AND user_id = ?`,
    { replacements: [weekId, userId], type: QueryTypes.SELECT }
  );
  return rows[0] || { rejected: 0, timed_out: 0 };
}

module.exports = { insert, findAccepted, findByPlayer, updateOutcome, getWeekBreakdown, countByPlayerAndWeek };
