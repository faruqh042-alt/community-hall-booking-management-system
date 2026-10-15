// controllers/bookingController.js
// Handles creating bookings, checking double-booking, viewing booking
// history, and (for admins) approving/rejecting bookings.

const { pool } = require('../db');
const { sendBookingNotification } = require('../utils/mailer');

// ---------------------------------------------------------
// POST /api/book  (logged-in users only)
// Body: { hall_id, date, time_slot }
// ---------------------------------------------------------
async function createBooking(req, res) {
  try {
    const userId = req.user.id; // set by verifyToken middleware
    const { hall_id, date, time_slot } = req.body;

    if (!hall_id || !date || !time_slot) {
      return res.status(400).json({ message: 'hall_id, date and time_slot are required.' });
    }

    // Don't allow bookings in the past
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      return res.status(400).json({ message: 'You cannot book a date in the past.' });
    }

    // Make sure the hall actually exists (also grab name/price for the
    // notification email below, so we don't need a second query later)
    const [hallRows] = await pool.query('SELECT id, name, price FROM halls WHERE id = ?', [hall_id]);
    if (hallRows.length === 0) {
      return res.status(404).json({ message: 'Hall not found.' });
    }
    const hall = hallRows[0];

    // ---- PREVENT DOUBLE BOOKING ----
    // A slot is considered taken if there's already a pending OR approved
    // booking for the same hall, date and time_slot. Rejected bookings
    // do not block the slot.
    const [clashRows] = await pool.query(
      `SELECT id FROM bookings
       WHERE hall_id = ? AND date = ? AND time_slot = ? AND status IN ('pending', 'approved')`,
      [hall_id, date, time_slot]
    );

    if (clashRows.length > 0) {
      return res.status(409).json({ message: 'This slot is already booked. Please choose another time.' });
    }

    const [result] = await pool.query(
      `INSERT INTO bookings (user_id, hall_id, date, time_slot, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, hall_id, date, time_slot]
    );

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
      bookingId: result.insertId
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

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: "status must be 'approved', 'rejected' or 'pending'." });
    }

    const [existing] = await pool.query('SELECT id FROM bookings WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    await pool.query('UPDATE bookings SET status = ? WHERE id = ?', [status, id]);
    return res.json({ message: `Booking ${status} successfully.` });
  } catch (err) {
    console.error('updateBookingStatus error:', err);
    return res.status(500).json({ message: 'Could not update booking status.' });
  }
}

module.exports = {
  createBooking,
  getMyBookings,
  getAllBookings,
  updateBookingStatus
};
