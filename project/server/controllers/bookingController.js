// controllers/bookingController.js
// Handles creating bookings, checking double-booking, viewing booking
// history, and (for admins) approving/rejecting bookings.

const { pool } = require('../db');
const { sendBookingNotification } = require('../utils/mailer');
const { recordAudit } = require('../utils/audit');

const TIME_SLOTS = [
  '9:00 AM - 12:00 PM',
  '12:00 PM - 3:00 PM',
  '3:00 PM - 6:00 PM',
  '6:00 PM - 9:00 PM'
];

// ---------------------------------------------------------
// POST /api/book  (logged-in users only)
// Body: { hall_id, date, time_slot }
// ---------------------------------------------------------
async function createBooking(req, res) {
  try {
    const userId = req.user.id; // set by verifyToken middleware
    const { hall_id, date, time_slot } = req.body;

    if (!Number.isSafeInteger(Number(hall_id)) || Number(hall_id) < 1 ||
        typeof date !== 'string' || !isValidDate(date) ||
        !TIME_SLOTS.includes(time_slot)) {
      return res.status(400).json({ message: 'hall_id, date and time_slot are required.' });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (date < today) {
      return res.status(400).json({ message: 'You cannot book a date in the past.' });
    }

    const connection = await pool.getConnection();
    let hall;
    let bookingId;
    try {
      await connection.beginTransaction();
      const [hallRows] = await connection.query(
        'SELECT id, name, price FROM halls WHERE id = ? AND is_active = 1 FOR UPDATE',
        [hall_id]
      );
      if (hallRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Hall not found or no longer available.' });
      }
      hall = hallRows[0];

      const [clashRows] = await connection.query(
        `SELECT id FROM bookings
         WHERE hall_id = ? AND date = ? AND time_slot = ? AND status IN ('pending', 'approved')
         LIMIT 1`,
        [hall_id, date, time_slot]
      );
      if (clashRows.length > 0) {
        await connection.rollback();
        return res.status(409).json({ message: 'This slot is already booked. Please choose another time.' });
      }

      const [result] = await connection.query(
        `INSERT INTO bookings (user_id, hall_id, date, time_slot, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [userId, hall_id, date, time_slot]
      );
      bookingId = result.insertId;
      await recordAudit(connection, {
        actorId: userId,
        action: 'booking.requested',
        entityType: 'booking',
        entityId: bookingId,
        details: { hallId: Number(hall_id), date, timeSlot: time_slot }
      });
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    // Email the owner about this new booking. This is "fire and forget" —
    // sendBookingNotification() catches its own errors internally, so a
    // misconfigured or unreachable mail server can NEVER cause the booking
    // request itself to fail. We also don't `await` it, so the customer's
    // response comes back immediately without waiting on the email.
    sendBookingNotification({
      userName: req.user.name,
      userEmail: req.user.email,
      hallName: hall.name,
      date,
      timeSlot: time_slot,
      price: hall.price
    });

    return res.status(201).json({
      message: 'Booking request submitted! Waiting for admin approval.',
      bookingId
    });
  } catch (err) {
    console.error('createBooking error:', err);
    return res.status(500).json({ message: 'Could not create booking.' });
  }
}

// ---------------------------------------------------------
// GET /api/bookings  (logged-in user's OWN booking history)
// ---------------------------------------------------------
async function getMyBookings(req, res) {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT b.id, b.date, b.time_slot, b.status, b.created_at,
              h.id AS hall_id, h.name AS hall_name, h.location, h.image, h.price
       FROM bookings b
       JOIN halls h ON b.hall_id = h.id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [userId]
    );

    return res.json(rows);
  } catch (err) {
    console.error('getMyBookings error:', err);
    return res.status(500).json({ message: 'Could not fetch your bookings.' });
  }
}

// ---------------- ADMIN ONLY ----------------

// GET /api/admin/bookings -> every booking, with user + hall info
async function getAllBookings(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.date, b.time_slot, b.status, b.created_at,
              u.id AS user_id, u.name AS user_name, u.email AS user_email,
              h.id AS hall_id, h.name AS hall_name
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN halls h ON b.hall_id = h.id
       ORDER BY b.created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    console.error('getAllBookings error:', err);
    return res.status(500).json({ message: 'Could not fetch bookings.' });
  }
}

// PUT /api/admin/bookings/:id -> approve or reject a booking
// Body: { status: 'approved' | 'rejected' }
async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!Number.isSafeInteger(Number(id)) || Number(id) < 1 ||
        !['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: "status must be 'approved', 'rejected' or 'cancelled'." });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existing] = await connection.query(
        `SELECT b.id, b.hall_id, b.date, b.time_slot, b.status
         FROM bookings b WHERE b.id = ? FOR UPDATE`,
        [id]
      );
      const booking = existing[0];
      if (!booking) {
        await connection.rollback();
        return res.status(404).json({ message: 'Booking not found.' });
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
          [booking.hall_id, booking.date, booking.time_slot, id]
        );
        if (clashes.length > 0) {
          await connection.rollback();
          return res.status(409).json({ message: 'Another booking already owns this time slot.' });
        }
      }

      await connection.query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
      await recordAudit(connection, {
        actorId: req.user.id,
        action: `booking.${status}`,
        entityType: 'booking',
        entityId: Number(id),
        details: { previousStatus: booking.status }
      });
      await connection.commit();
      return res.json({ message: `Booking ${status} successfully.` });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('updateBookingStatus error:', err);
    return res.status(500).json({ message: 'Could not update booking status.' });
  }
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

module.exports = {
  createBooking,
  getMyBookings,
  getAllBookings,
  updateBookingStatus,
  TIME_SLOTS,
  isValidDate
};
