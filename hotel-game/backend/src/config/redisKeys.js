module.exports = {
  sessionState: (sessionId) => `session:${sessionId}:state`,
  decisions: (sessionId, weekNum, guestIndex) =>
    `session:${sessionId}:week:${weekNum}:guest:${guestIndex}:decisions`,
  playerRooms: (sessionId, userId) =>
    `session:${sessionId}:player:${userId}:rooms`,
  playerCount: (sessionId) => `session:${sessionId}:playerCount`,
  guestTimer: (sessionId, weekNum) =>
    `session:${sessionId}:week:${weekNum}:guestTimer`,
  currentGuest: (sessionId, weekNum) =>
    `session:${sessionId}:week:${weekNum}:currentGuest`,
};
