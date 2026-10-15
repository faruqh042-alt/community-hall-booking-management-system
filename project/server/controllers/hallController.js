// controllers/hallController.js
// Handles reading hall data (public) and admin add/edit/delete of halls.

const { pool } = require('../db');

// GET /api/halls  -> list every hall
async function getAllHalls(req, res) {
  try {
    const [halls] = await pool.query('SELECT * FROM halls ORDER BY id DESC');
    return res.json(halls);
  } catch (err) {
    console.error('getAllHalls error:', err);
    return res.status(500).json({ message: 'Could not fetch halls.' });
  }
}

// GET /api/halls/:id -> single hall's details
async function getHallById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM halls WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Hall not found.' });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error('getHallById error:', err);
    return res.status(500).json({ message: 'Could not fetch hall details.' });
  }
}

// GET /api/halls/:id/availability?date=YYYY-MM-DD
// Returns the time slots already booked (pending/approved) for that hall+date
async function getHallAvailability(req, res) {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ message: 'A date query parameter is required.' });
    }

    const [rows] = await pool.query(
      `SELECT time_slot, status FROM bookings
       WHERE hall_id = ? AND date = ? AND status IN ('pending', 'approved')`,
      [id, date]
    );

    const bookedSlots = rows.map(r => r.time_slot);
    return res.json({ date, bookedSlots });
  } catch (err) {
    console.error('getHallAvailability error:', err);
    return res.status(500).json({ message: 'Could not check availability.' });
  }
}

// ---------------- ADMIN ONLY ----------------

// POST /api/admin/halls -> add a new hall
async function addHall(req, res) {
  try {
    const { name, description, price, capacity, location, image } = req.body;

    if (!name || !price || !capacity || !location) {
      return res.status(400).json({ message: 'name, price, capacity and location are required.' });
    }

    const [result] = await pool.query(
      `INSERT INTO halls (name, description, price, capacity, location, image)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || '', price, capacity, location, image || 'images/default-hall.jpg']
    );

    return res.status(201).json({ message: 'Hall added successfully.', hallId: result.insertId });
  } catch (err) {
    console.error('addHall error:', err);
    return res.status(500).json({ message: 'Could not add hall.' });
  }
}

// PUT /api/admin/halls/:id -> edit a hall
async function updateHall(req, res) {
  try {
    const { id } = req.params;
    const { name, description, price, capacity, location, image } = req.body;

    const [existing] = await pool.query('SELECT id FROM halls WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Hall not found.' });
    }

    await pool.query(
      `UPDATE halls SET name = ?, description = ?, price = ?, capacity = ?, location = ?, image = ?
       WHERE id = ?`,
      [name, description, price, capacity, location, image, id]
    );

    return res.json({ message: 'Hall updated successfully.' });
  } catch (err) {
    console.error('updateHall error:', err);
    return res.status(500).json({ message: 'Could not update hall.' });
  }
}

// DELETE /api/admin/halls/:id -> remove a hall
async function deleteHall(req, res) {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT id FROM halls WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Hall not found.' });
    }

    await pool.query('DELETE FROM halls WHERE id = ?', [id]);
    return res.json({ message: 'Hall deleted successfully.' });
  } catch (err) {
    console.error('deleteHall error:', err);
    return res.status(500).json({ message: 'Could not delete hall.' });
  }
}

module.exports = {
  getAllHalls,
  getHallById,
  getHallAvailability,
  addHall,
  updateHall,
  deleteHall
};
