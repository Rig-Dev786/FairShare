// controllers/userController.js

const pool = require('../db/pool');

// GET /api/users
async function listUsers(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT user_id, username, full_name, email, created_at
         FROM Users
        ORDER BY full_name ASC`
    );
    return res.json({ users: rows });
  } catch (err) {
    console.error('[listUsers]', err.message);
    return res.status(500).json({ error: 'Failed to fetch users.' });
  }
}

// POST /api/users
async function createUser(req, res) {
  const { full_name, username, email } = req.body;

  if (!full_name || !username || !email) {
    return res.status(400).json({ error: 'full_name, username, and email are required.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO Users (full_name, username, email)
       VALUES ($1, $2, $3)
       RETURNING user_id, full_name, username, email, created_at`,
      [full_name.trim(), username.trim().toLowerCase(), email.trim().toLowerCase()]
    );
    return res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error('[createUser]', err.message);
    if (err.code === '23505') {
      const field = err.detail?.includes('username') ? 'username' : 'email';
      return res.status(409).json({ error: `That ${field} is already taken.` });
    }
    return res.status(500).json({ error: 'Failed to create user.' });
  }
}

module.exports = { listUsers, createUser };
