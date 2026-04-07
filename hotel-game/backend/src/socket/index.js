const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const gameHandler = require('./handlers/gameHandler');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ['GET', 'POST'],
    },
  });

  // JWT auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userRepository.findById(decoded.id);
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.user.name} (${socket.user.id})`);

    gameHandler(io, socket);

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.user.name}`);
    });
  });

  console.log('[Socket] Server initialized with JWT auth');
  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
