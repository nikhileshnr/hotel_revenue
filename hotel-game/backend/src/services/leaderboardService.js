const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');
const playerStateRepository = require('../repositories/playerStateRepository');
const sessionRepository = require('../repositories/sessionRepository');

function buildLeaderboard(playerStates) {
  const sorted = [...playerStates].sort(
    (a, b) => parseFloat(b.total_revenue) - parseFloat(a.total_revenue)
  );

  return sorted.map((ps, index) => ({
    rank: index + 1,
    user_id: ps.user_id,
    name: ps.name || 'Unknown',
    branch: ps.branch || null,
    total_revenue: parseFloat(ps.total_revenue),
    hotel_type: ps.hotel_type || null,
  }));
}

async function getSessionLeaderboard(sessionId) {
  const [playerStates, players] = await Promise.all([
    playerStateRepository.findBySession(sessionId),
    sessionRepository.getPlayers(sessionId),
  ]);

  const playerMap = {};
  for (const p of players) {
    playerMap[p.user_id] = p.name;
  }

  const enriched = playerStates.map((ps) => ({
    ...ps,
    name: playerMap[ps.user_id] || 'Unknown',
  }));

  return buildLeaderboard(enriched);
}

async function getGlobalLeaderboard(branch) {
  let query = `
    SELECT u.id AS user_id, u.name, u.branch,
           ps.total_revenue, gs.hotel_type, gs.completed_at
    FROM player_states ps
    JOIN users u ON u.id = ps.user_id
    JOIN game_sessions gs ON gs.id = ps.session_id
    WHERE gs.status = 'completed'
  `;
  const replacements = [];

  if (branch) {
    query += ' AND u.branch = ?';
    replacements.push(branch);
  }

  query += ' ORDER BY ps.total_revenue DESC LIMIT 50';

  const rows = await sequelize.query(query, {
    replacements,
    type: QueryTypes.SELECT,
  });

  return rows.map((r, index) => ({
    rank: index + 1,
    user_id: r.user_id,
    name: r.name,
    branch: r.branch,
    total_revenue: parseFloat(r.total_revenue),
    hotel_type: r.hotel_type,
    completed_at: r.completed_at,
  }));
}

module.exports = { getSessionLeaderboard, getGlobalLeaderboard };
