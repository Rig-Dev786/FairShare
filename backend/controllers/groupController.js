// controllers/groupController.js

const pool = require('../db/pool');

// GET /api/groups
async function listGroups(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT 
          g.group_id,
          g.group_name,
          g.description,
          g.created_by,
          u.full_name AS created_by_name,
          COUNT(gm.user_id)::int AS member_count,
          g.created_at
      FROM Groups g
      JOIN Users u 
          ON u.user_id = g.created_by
      LEFT JOIN GroupMembers gm 
          ON gm.group_id = g.group_id
      GROUP BY 
          g.group_id,
          g.group_name,
          g.description,
          g.created_by,
          g.created_at,
          u.full_name
      ORDER BY g.created_at DESC
    `);

    return res.json({ groups: rows });

  } catch (err) {
    console.error('[listGroups]', err.message);

    return res.status(500).json({
      error: 'Failed to fetch groups.'
    });
  }
}

// POST /api/groups
async function createGroup(req, res) {
  const { group_name, description, created_by } = req.body;

  if (!group_name || !created_by) {
    return res.status(400).json({ error: 'group_name and created_by are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create the group
    const groupResult = await client.query(
      `INSERT INTO Groups (group_name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING group_id, group_name, description, created_by, created_at`,
      [group_name.trim(), description?.trim() || null, created_by]
    );
    const group = groupResult.rows[0];

    // Auto-add the creator as a member
    await client.query(
      `INSERT INTO GroupMembers (group_id, user_id) VALUES ($1, $2)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [group.group_id, created_by]
    );

    await client.query('COMMIT');
    return res.status(201).json({ group });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[createGroup]', err.message);
    return res.status(500).json({ error: 'Failed to create group.' });
  } finally {
    client.release();
  }
}

// GET /api/groups/:groupId/members
async function getGroupMembers(req, res) {
  const { groupId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT u.user_id, u.full_name, u.username, u.email, gm.joined_at
         FROM GroupMembers gm
         JOIN Users u ON u.user_id = gm.user_id
        WHERE gm.group_id = $1 AND gm.is_active = TRUE
        ORDER BY u.full_name ASC`,
      [groupId]
    );
    return res.json({ members: rows });
  } catch (err) {
    console.error('[getGroupMembers]', err.message);
    return res.status(500).json({ error: 'Failed to fetch members.' });
  }
}

// POST /api/groups/:groupId/members
async function addMembers(req, res) {
  const { groupId } = req.params;
  const { user_ids } = req.body; // array of UUIDs

  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({ error: 'user_ids must be a non-empty array.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const added = [];
    const skipped = [];

    for (const user_id of user_ids) {
      const result = await client.query(
        `INSERT INTO GroupMembers (group_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (group_id, user_id) DO UPDATE SET is_active = TRUE
         RETURNING user_id`,
        [groupId, user_id]
      );
      if (result.rows.length > 0) added.push(user_id);
      else skipped.push(user_id);
    }

    await client.query('COMMIT');
    return res.status(201).json({
      message: `${added.length} member(s) added.`,
      added,
      skipped,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[addMembers]', err.message);
    return res.status(500).json({ error: 'Failed to add members.' });
  } finally {
    client.release();
  }
}

module.exports = { listGroups, createGroup, getGroupMembers, addMembers };
