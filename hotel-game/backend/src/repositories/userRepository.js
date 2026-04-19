const { QueryTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');

async function findByEmail(email) {
  const rows = await sequelize.query(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    { replacements: [email], type: QueryTypes.SELECT }
  );
  return rows[0] || undefined;
}

async function findById(id) {
  const rows = await sequelize.query(
    'SELECT id, name, email, branch, created_at FROM users WHERE id = ? LIMIT 1',
    { replacements: [id], type: QueryTypes.SELECT }
  );
  return rows[0] || undefined;
}

async function insert({ name, email, password_hash, branch }) {
  const id = uuidv4();
  await sequelize.query(
    'INSERT INTO users (id, name, email, password_hash, branch, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
    { replacements: [id, name, email, password_hash, branch || null], type: QueryTypes.INSERT }
  );
  return { id, name, email, branch };
}

async function getDistinctBranches() {
  const rows = await sequelize.query(
    'SELECT DISTINCT branch FROM users WHERE branch IS NOT NULL ORDER BY branch ASC',
    { type: QueryTypes.SELECT }
  );
  return rows.map((r) => r.branch);
}

module.exports = { findByEmail, findById, insert, getDistinctBranches };
