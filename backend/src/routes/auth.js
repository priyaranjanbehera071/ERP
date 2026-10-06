const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { h, bad, HttpError } = require('../util');
const { authenticate } = require('../middleware/auth');

const sign = (u) => ({
  token: jwt.sign({ id: u.id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '8h' }),
  user: { id: u.id, name: u.name, email: u.email, role: u.role },
});

// Public registration always creates a SALES user. Admins are created via seed/DB only.
router.post('/register', h(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim()) throw bad('Name is required');
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw bad('A valid email is required');
  if (!password || password.length < 8) throw bad('Password must be at least 8 characters');
  try {
    const { rows } = await query(
      `INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,'SALES') RETURNING *`,
      [name.trim(), email.toLowerCase(), await bcrypt.hash(password, 10)]);
    res.status(201).json(sign(rows[0]));
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'This email is already registered');
    throw e;
  }
}));

router.post('/login', h(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw bad('Email and password are required');
  const { rows } = await query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) throw new HttpError(401, 'Incorrect email or password');
  res.json(sign(u));
}));

router.get('/me', authenticate, (req, res) => res.json(req.user));
module.exports = router;
