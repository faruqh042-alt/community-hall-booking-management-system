const { pool } = require('../db');
const { recordAudit } = require('../utils/audit');
const { validHallInput } = require('./hallController');

async function getDashboard(req, res) {
  try {
    const [halls] = await pool.query(
      `SELECT h.id, h.name, h.location, h.description, h.price, h.capacity, h.image, h.facilities,
              mh.can_edit_price
       FROM manager_halls mh JOIN halls h ON h.id = mh.hall_id
       WHERE mh.manager_id = ? AND h.is_active = 1 ORDER BY h.name`,
      [req.user.id]
    );
    const [[stats]] = await pool.query(
      `SELECT COUNT(b.id) AS bookings,
              COALESCE(SUM(b.status = 'pending'), 0) AS pending,
              COALESCE(SUM(b.status = 'approved'), 0) AS approved,
              COALESCE(SUM(b.status = 'cancelled'), 0) AS cancelled
       FROM manager_halls mh
       JOIN halls h ON h.id = mh.hall_id AND h.is_active = 1
       LEFT JOIN bookings b ON b.hall_id = h.id
       WHERE mh.manager_id = ?`,
      [req.user.id]
    );
    const [upcoming] = await pool.query(
      `SELECT b.id, b.date, b.time_slot, b.status,
              u.name AS user_name, h.id AS hall_id, h.name AS hall_name, h.location
       FROM bookings b JOIN manager_halls mh ON mh.hall_id = b.hall_id AND mh.manager_id = ?
       JOIN users u ON u.id = b.user_id JOIN halls h ON h.id = b.hall_id
       WHERE b.date >= CURRENT_DATE AND b.status IN ('pending', 'approved')
       ORDER BY b.date, b.time_slot LIMIT 10`,
      [req.user.id]
    );
    const [recentActivity] = await pool.query(
      `SELECT b.id, b.date, b.time_slot, b.status, b.created_at,
              u.name AS user_name, h.name AS hall_name
       FROM bookings b JOIN manager_halls mh ON mh.hall_id = b.hall_id AND mh.manager_id = ?
       JOIN users u ON u.id = b.user_id JOIN halls h ON h.id = b.hall_id
       ORDER BY b.created_at DESC LIMIT 8`,
      [req.user.id]
    );
    return res.json({
      stats: {
        halls: halls.length,
        bookings: Number(stats.bookings),
        pending: Number(stats.pending),
        approved: Number(stats.approved),
        cancelled: Number(stats.cancelled)
      },
      halls,
      upcoming,
      recentActivity
    });
  } catch (err) {
    console.error('getManagerDashboard error:', err);
    return res.status(500).json({ message: 'Could not load manager dashboard data.' });
  }
}

async function listBookings(req, res) {
  try {
    const page = positiveInt(req.query.page, 1, 100000);
    const limit = positiveInt(req.query.limit, 25, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
    const validStatuses = new Set(['pending', 'approved', 'rejected', 'cancelled']);
    if (status && !validStatuses.has(status)) {
      return res.status(400).json({ message: 'Choose a valid booking status filter.' });
    }
    const clauses = ['mh.manager_id = ?'];
    const params = [req.user.id];
    if (status) { clauses.push('b.status = ?'); params.push(status); }
    if (search) {
      clauses.push('(u.name LIKE ? OR u.email LIKE ? OR h.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const where = clauses.join(' AND ');
    const [[count]] = await pool.query(
      `SELECT COUNT(*) AS total FROM bookings b
       JOIN manager_halls mh ON mh.hall_id = b.hall_id
       JOIN users u ON u.id = b.user_id JOIN halls h ON h.id = b.hall_id
       WHERE ${where}`,
      params
    );
    const [bookings] = await pool.query(
      `SELECT b.id, b.date, b.time_slot, b.status, b.created_at,
              u.name AS user_name, u.email AS user_email,
              h.id AS hall_id, h.name AS hall_name, h.location, h.price, h.capacity
       FROM bookings b
       JOIN manager_halls mh ON mh.hall_id = b.hall_id
       JOIN users u ON u.id = b.user_id JOIN halls h ON h.id = b.hall_id
       WHERE ${where} ORDER BY b.date DESC, b.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return res.json({ bookings, page, limit, total: Number(count.total) });
  } catch (err) {
    console.error('listManagerBookings error:', err);
    return res.status(500).json({ message: 'Could not load assigned-hall bookings.' });
  }
}

async function getCalendar(req, res) {
  const month = typeof req.query.month === 'string' ? req.query.month : '';
  const match = month.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return res.status(400).json({ message: 'Provide a calendar month in YYYY-MM format.' });
  const start = `${month}-01`;
  const end = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1)).toISOString().slice(0, 10);
  try {
    const [bookings] = await pool.query(
      `SELECT b.id, b.date, b.time_slot, b.status, u.name AS user_name, h.name AS hall_name
       FROM bookings b
       JOIN manager_halls mh ON mh.hall_id = b.hall_id AND mh.manager_id = ?
       JOIN users u ON u.id = b.user_id
       JOIN halls h ON h.id = b.hall_id
       WHERE b.date >= ? AND b.date < ? AND b.status IN ('pending', 'approved')
       ORDER BY b.date, b.time_slot LIMIT 500`,
      [req.user.id, start, end]
    );
    return res.json(bookings);
  } catch (err) {
    console.error('getManagerCalendar error:', err);
    return res.status(500).json({ message: 'Could not load assigned-hall calendar.' });
  }
}

async function updateHall(req, res) {
  const hallId = positiveInt(req.params.id, 0, Number.MAX_SAFE_INTEGER);
  if (!hallId) return res.status(400).json({ message: 'Invalid hall id.' });

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [assignmentRows] = await connection.query(
      `SELECT mh.can_edit_price, h.price
       FROM manager_halls mh JOIN halls h ON h.id = mh.hall_id
       WHERE mh.manager_id = ? AND mh.hall_id = ? AND h.is_active = 1
       FOR UPDATE`,
      [req.user.id, hallId]
    );
    const assignment = assignmentRows[0];
    if (!assignment) {
      await connection.rollback();
      return res.status(404).json({ message: 'Assigned hall not found.' });
    }
    const input = { ...req.body, price: assignment.price };
    if (!validHallInput(input, false)) {
      await connection.rollback();
      return res.status(400).json({ message: 'Provide valid hall information.' });
    }
    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (!assignment.can_edit_price || !Number.isFinite(price) || price < 0) {
        await connection.rollback();
        return res.status(403).json({ message: 'You are not authorized to change this hall price.' });
      }
      input.price = price;
    }
    await connection.query(
      `UPDATE halls SET name = ?, description = ?, price = ?, capacity = ?, location = ?, image = ?, facilities = ?
       WHERE id = ? AND is_active = 1`,
      [input.name.trim(), input.description || '', Number(input.price), Number(input.capacity),
        input.location.trim(), input.image || '', input.facilities || '', hallId]
    );
    await recordAudit(connection, {
      actorId: req.user.id,
      action: 'hall.updated',
      entityType: 'hall',
      entityId: hallId
    });
    await connection.commit();
    return res.json({ message: 'Hall information updated.' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('updateManagerHall error:', err);
    return res.status(500).json({ message: 'Could not update assigned hall.' });
  } finally {
    if (connection) connection.release();
  }
}

async function updateBookingStatus(req, res) {
  const bookingId = positiveInt(req.params.id, 0, Number.MAX_SAFE_INTEGER);
  const status = req.body.status;
  if (!bookingId || !['approved', 'rejected', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Choose a valid booking and status.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT b.id, b.hall_id, b.date, b.time_slot, b.status
       FROM bookings b
       JOIN manager_halls mh ON mh.hall_id = b.hall_id AND mh.manager_id = ?
       JOIN halls h ON h.id = b.hall_id AND h.is_active = 1
       WHERE b.id = ? FOR UPDATE`,
      [req.user.id, bookingId]
    );
    const booking = rows[0];
    if (!booking) {
      await connection.rollback();
      return res.status(404).json({ message: 'Booking not found for your assigned halls.' });
    }
    if (booking.status !== 'pending' &&
        !(booking.status === 'approved' && status === 'cancelled')) {
      await connection.rollback();
      return res.status(409).json({ message: 'This booking can no longer be changed.' });
    }

    await connection.query('SELECT id FROM halls WHERE id = ? FOR UPDATE', [booking.hall_id]);
    if (status === 'approved') {
      const [clashes] = await connection.query(
        `SELECT id FROM bookings
         WHERE hall_id = ? AND date = ? AND time_slot = ? AND status = 'approved' AND id <> ?
         LIMIT 1`,
        [booking.hall_id, booking.date, booking.time_slot, bookingId]
      );
      if (clashes.length) {
        await connection.rollback();
        return res.status(409).json({ message: 'Another booking is already approved for this time slot.' });
      }
    }
    await connection.query('UPDATE bookings SET status = ? WHERE id = ?', [status, bookingId]);
    await recordAudit(connection, {
      actorId: req.user.id,
      action: `booking.${status}`,
      entityType: 'booking',
      entityId: bookingId,
      details: { previousStatus: booking.status }
    });
    await connection.commit();
    return res.json({ message: `Booking ${status} successfully.` });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('updateManagerBooking error:', err);
    return res.status(500).json({ message: 'Could not update booking status.' });
  } finally {
    if (connection) connection.release();
  }
}

function positiveInt(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

module.exports = { getDashboard, listBookings, getCalendar, updateHall, updateBookingStatus };
