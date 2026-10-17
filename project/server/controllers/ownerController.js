const { pool } = require('../db');
const { recordAudit } = require('../utils/audit');

const ROLES = new Set(['user', 'manager']);
const BOOKING_STATUSES = new Set(['pending', 'approved', 'rejected', 'cancelled']);

async function getDashboard(req, res) {
  try {
    const [[users]] = await pool.query(
      "SELECT COUNT(*) AS total, SUM(role = 'manager') AS managers FROM users WHERE role IN ('user', 'manager') AND is_active = 1"
    );
    const [[halls]] = await pool.query(
      'SELECT COUNT(*) AS total, SUM(is_active = 1) AS active FROM halls'
    );
    const [bookingRows] = await pool.query(
      `SELECT status, COUNT(*) AS total FROM bookings GROUP BY status`
    );
    const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    let totalBookings = 0;
    bookingRows.forEach(row => {
      counts[row.status] = Number(row.total);
      totalBookings += Number(row.total);
    });
    const [recentBookings] = await pool.query(
      `SELECT b.id, b.date, b.time_slot, b.status, b.created_at,
              u.name AS user_name, u.email AS user_email,
              h.name AS hall_name, h.location
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       JOIN halls h ON h.id = b.hall_id
       ORDER BY b.created_at DESC LIMIT 8`
    );
    const [recentUsers] = await pool.query(
      `SELECT id, name, email, role, created_at, is_active
       FROM users WHERE role IN ('user', 'manager')
       ORDER BY created_at DESC LIMIT 8`
    );
    const [hallPerformance] = await pool.query(
      `SELECT h.id, h.name, h.location, h.is_active, h.capacity,
              COUNT(b.id) AS bookings,
              SUM(b.status = 'approved') AS approved_bookings,
              SUM(b.status = 'pending') AS pending_bookings
       FROM halls h LEFT JOIN bookings b ON b.hall_id = h.id
       GROUP BY h.id ORDER BY bookings DESC, h.id DESC LIMIT 8`
    );
    const [monthlyBookings] = await pool.query(
      `SELECT DATE_FORMAT(date, '%Y-%m') AS month, COUNT(*) AS total
       FROM bookings
       WHERE date >= DATE_SUB(CURRENT_DATE, INTERVAL 5 MONTH)
       GROUP BY DATE_FORMAT(date, '%Y-%m')
       ORDER BY month`
    );
    const [recentActivity] = await pool.query(
      `SELECT e.id, e.actor_id, u.name AS actor_name, e.action, e.entity_type,
              e.entity_id, e.details, e.created_at
       FROM audit_events e LEFT JOIN users u ON u.id = e.actor_id
       ORDER BY e.created_at DESC, e.id DESC LIMIT 10`
    );

    return res.json({
      stats: {
        users: Number(users.total) || 0,
        managers: Number(users.managers) || 0,
        halls: Number(halls.total) || 0,
        activeHalls: Number(halls.active) || 0,
        bookings: totalBookings,
        ...counts,
        revenue: { available: false, total: null, reason: 'No payment or transaction records exist in this system.' }
      },
      recentBookings,
      recentUsers,
      hallPerformance,
      monthlyBookings,
      recentActivity
    });
  } catch (err) {
    console.error('getOwnerDashboard error:', err);
    return res.status(500).json({ message: 'Could not load owner dashboard data.' });
  }
}

async function listUsers(req, res) {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const offset = (page - 1) * limit;
    const role = req.query.role;
    const active = req.query.active;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
    if (role && !ROLES.has(role)) {
      return res.status(400).json({ message: 'Filter by user or manager role.' });
    }

    const clauses = ["role IN ('user', 'manager')"];
    const params = [];
    if (role) { clauses.push('role = ?'); params.push(role); }
    if (active === 'true' || active === 'false') {
      clauses.push('is_active = ?');
      params.push(active === 'true' ? 1 : 0);
    }
    if (search) {
      clauses.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = clauses.join(' AND ');
    const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE ${where}`, params);
    const [rows] = await pool.query(
      `SELECT id, name, email, role, is_active, created_at
       FROM users WHERE ${where}
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return res.json({ users: rows, page, limit, total: Number(count.total) });
  } catch (err) {
    console.error('listOwnerUsers error:', err);
    return res.status(500).json({ message: 'Could not load user accounts.' });
  }
}

async function updateUserRole(req, res) {
  const userId = parseId(req.params.id);
  const role = req.body.role;
  if (!userId || !ROLES.has(role)) {
    return res.status(400).json({ message: 'Choose a valid user or manager role.' });
  }
  if (userId === req.user.id) {
    return res.status(409).json({ message: 'You cannot change your own role.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT id, role, email FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    if (!rows[0] || rows[0].email.toLowerCase() === 'faruqh042@gmail.com' || rows[0].role === 'admin') {
      await connection.rollback();
      return res.status(404).json({ message: 'This account cannot be managed here.' });
    }
    await connection.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    if (role !== 'manager') {
      await connection.query('DELETE FROM manager_halls WHERE manager_id = ?', [userId]);
    }
    await recordAudit(connection, {
      actorId: req.user.id,
      action: 'user.role_changed',
      entityType: 'user',
      entityId: userId,
      details: { role }
    });
    await connection.commit();
    return res.json({ message: `Account role updated to ${role}.` });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('updateUserRole error:', err);
    return res.status(500).json({ message: 'Could not update this account role.' });
  } finally {
    if (connection) connection.release();
  }
}

async function setUserActive(req, res) {
  const userId = parseId(req.params.id);
  const active = req.body.active;
  if (!userId || typeof active !== 'boolean') {
    return res.status(400).json({ message: 'Provide a valid account and active true/false value.' });
  }
  if (userId === req.user.id) {
    return res.status(409).json({ message: 'You cannot deactivate your own account.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT id, is_active FROM users
       WHERE id = ? AND role IN ('user', 'manager') AND LOWER(email) <> LOWER(?)
       FOR UPDATE`,
      [userId, 'faruqh042@gmail.com']
    );
    if (!rows[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'This user or manager account was not found.' });
    }
    if (Boolean(rows[0].is_active) !== active) {
      await connection.query('UPDATE users SET is_active = ? WHERE id = ?', [active ? 1 : 0, userId]);
      await recordAudit(connection, {
        actorId: req.user.id,
        action: active ? 'user.activated' : 'user.deactivated',
        entityType: 'user',
        entityId: userId
      });
    }
    await connection.commit();
    return res.json({ message: `Account ${active ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('setOwnerUserActive error:', err);
    return res.status(500).json({ message: 'Could not update account status.' });
  } finally {
    if (connection) connection.release();
  }
}

async function listHalls(req, res) {
  try {
    const [halls] = await pool.query('SELECT * FROM halls ORDER BY is_active DESC, id DESC');
    return res.json(halls);
  } catch (err) {
    console.error('listOwnerHalls error:', err);
    return res.status(500).json({ message: 'Could not load halls.' });
  }
}

async function setHallActive(req, res) {
  const hallId = parseId(req.params.id);
  const active = req.body.active;
  if (!hallId || typeof active !== 'boolean') {
    return res.status(400).json({ message: 'Provide a valid hall and active true/false value.' });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT id, is_active FROM halls WHERE id = ? FOR UPDATE',
      [hallId]
    );
    if (!rows[0]) {
      await connection.rollback();
      return res.status(404).json({ message: 'Hall not found.' });
    }
    if (Boolean(rows[0].is_active) !== active) {
      await connection.query('UPDATE halls SET is_active = ? WHERE id = ?', [active ? 1 : 0, hallId]);
      await recordAudit(connection, {
        actorId: req.user.id,
        action: active ? 'hall.activated' : 'hall.deactivated',
        entityType: 'hall',
        entityId: hallId
      });
    }
    await connection.commit();
    return res.json({ message: `Hall ${active ? 'activated' : 'deactivated'}; booking history was preserved.` });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('setOwnerHallActive error:', err);
    return res.status(500).json({ message: 'Could not update hall status.' });
  } finally {
    if (connection) connection.release();
  }
}

async function listManagerHalls(req, res) {
  const managerId = parseId(req.params.id);
  if (!managerId) return res.status(400).json({ message: 'Invalid manager id.' });
  try {
    const [rows] = await pool.query(
      `SELECT hall_id, can_edit_price FROM manager_halls WHERE manager_id = ?`,
      [managerId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('listManagerHalls error:', err);
    return res.status(500).json({ message: 'Could not load manager hall assignments.' });
  }
}

async function setManagerHalls(req, res) {
  const managerId = parseId(req.params.id);
  const assignments = req.body.halls;
  if (!managerId || !Array.isArray(assignments) || assignments.length > 200 ||
      assignments.some(hall => !hall || !parseId(hall.id) ||
        hall.canEditPrice !== undefined && typeof hall.canEditPrice !== 'boolean')) {
    return res.status(400).json({ message: 'Provide a valid list of hall assignments.' });
  }

  const unique = new Map(assignments.map(hall => [Number(hall.id), hall.canEditPrice === true]));
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [managerRows] = await connection.query(
      `SELECT id FROM users WHERE id = ? AND role = 'manager' AND is_active = 1 FOR UPDATE`,
      [managerId]
    );
    if (managerRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Active manager account not found.' });
    }
    const hallIds = [...unique.keys()];
    if (hallIds.length) {
      const [halls] = await connection.query(
        `SELECT id FROM halls WHERE is_active = 1 AND id IN (${hallIds.map(() => '?').join(',')})`,
        hallIds
      );
      if (halls.length !== hallIds.length) {
        await connection.rollback();
        return res.status(400).json({ message: 'One or more selected halls are not active.' });
      }
    }
    await connection.query('DELETE FROM manager_halls WHERE manager_id = ?', [managerId]);
    for (const [hallId, canEditPrice] of unique) {
      await connection.query(
        'INSERT INTO manager_halls (manager_id, hall_id, can_edit_price) VALUES (?, ?, ?)',
        [managerId, hallId, canEditPrice ? 1 : 0]
      );
    }
    await recordAudit(connection, {
      actorId: req.user.id,
      action: 'manager.halls_assigned',
      entityType: 'user',
      entityId: managerId,
      details: { hallIds: hallIds.sort((a, b) => a - b) }
    });
    await connection.commit();
    return res.json({ message: 'Manager hall assignments updated.', hallCount: unique.size });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('setManagerHalls error:', err);
    return res.status(500).json({ message: 'Could not update hall assignments.' });
  } finally {
    if (connection) connection.release();
  }
}

async function listBookings(req, res) {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
    if (status && !BOOKING_STATUSES.has(status)) {
      return res.status(400).json({ message: 'Choose a valid booking status filter.' });
    }

    const clauses = ['1 = 1'];
    const params = [];
    if (status) { clauses.push('b.status = ?'); params.push(status); }
    if (search) {
      clauses.push('(u.name LIKE ? OR u.email LIKE ? OR h.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const where = clauses.join(' AND ');
    const [[count]] = await pool.query(
      `SELECT COUNT(*) AS total FROM bookings b JOIN users u ON u.id = b.user_id
       JOIN halls h ON h.id = b.hall_id WHERE ${where}`,
      params
    );
    const [bookings] = await pool.query(
      `SELECT b.id, b.date, b.time_slot, b.status, b.created_at,
              u.id AS user_id, u.name AS user_name, u.email AS user_email,
              h.id AS hall_id, h.name AS hall_name, h.location, h.price, h.capacity
       FROM bookings b JOIN users u ON u.id = b.user_id JOIN halls h ON h.id = b.hall_id
       WHERE ${where} ORDER BY b.created_at DESC, b.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return res.json({ bookings, page, limit, total: Number(count.total) });
  } catch (err) {
    console.error('listOwnerBookings error:', err);
    return res.status(500).json({ message: 'Could not load booking history.' });
  }
}

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function parsePage(value) {
  const page = Number(value || 1);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
}
function parseLimit(value) {
  const limit = Number(value || 25);
  return Number.isSafeInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;
}

module.exports = {
  getDashboard,
  listUsers,
  updateUserRole,
  setUserActive,
  listManagerHalls,
  listHalls,
  setHallActive,
  setManagerHalls,
  listBookings
};
