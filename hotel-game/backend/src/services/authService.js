const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

function signJwt(user) {
  return jwt.sign(
    { id: user.id, email: user.email, branch: user.branch },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function register({ name, email, password, branch }) {
  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const password_hash = await bcrypt.hash(password, 12);
  const user = await userRepository.insert({ name, email, password_hash, branch });
  const token = signJwt(user);

  return { user, token };
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  const { password_hash, ...safeUser } = user;
  const token = signJwt(safeUser);

  return { user: safeUser, token };
}

module.exports = { register, login };
