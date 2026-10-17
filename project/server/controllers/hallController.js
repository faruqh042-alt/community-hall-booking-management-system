// controllers/hallController.js
// Handles reading hall data (public) and admin add/edit/delete of halls.

const { pool } = require('../db');
const { recordAudit } = require('../utils/audit');

// GET /api/halls  -> list every hall
async function getAllHalls(req, res) {
  try {
    const [halls] = await pool.query('SELECT * FROM halls WHERE is_active = 1 ORDER BY id DESC');
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
    const [rows] = await pool.query('SELECT * FROM halls WHERE id = ? AND is_active = 1', [id]);

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

    const [hallRows] = await pool.query('SELECT id FROM halls WHERE id = ? AND is_active = 1', [id]);
    if (hallRows.length === 0) {
      return res.status(404).json({ message: 'Hall not found.' });
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
  let connection;
  try {
    const { name, description, price, capacity, location, image, facilities } = req.body;

    if (!validHallInput({ name, description, price, capacity, location, image, facilities }, true)) {
      return res.status(400).json({ message: 'name, price, capacity and location are required.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO halls (name, description, price, capacity, location, image, facilities)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), description || '', Number(price), Number(capacity), location.trim(),
        image || '', facilities || '']
    );
    await recordAudit(connection, {
      actorId: req.user.id,
      action: 'hall.created',
      entityType: 'hall',
      entityId: result.insertId
    });
    await connection.commit();

    return res.status(201).json({ message: 'Hall added successfully.', hallId: result.insertId });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('addHall error:', err);
    return res.status(500).json({ message: 'Could not add hall.' });
  } finally {
    if (connection) connection.release();
  }
}

// PUT /api/admin/halls/:id -> edit a hall
async function updateHall(req, res) {
  let connection;
  try {
    const { id } = req.params;
    const { name, description, price, capacity, location, image, facilities } = req.body;
    if (!validHallInput({ name, description, price, capacity, location, image, facilities }, false)) {
      return res.status(400).json({ message: 'Provide valid hall details.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [existing] = await connection.query(
      'SELECT id FROM halls WHERE id = ? AND is_active = 1 FOR UPDATE',
      [id]
    );
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Hall not found.' });
    }

    await connection.query(
      `UPDATE halls SET name = ?, description = ?, price = ?, capacity = ?, location = ?, image = ?, facilities = ?
       WHERE id = ?`,
      [name.trim(), description || '', Number(price), Number(capacity), location.trim(), image || '', facilities || '', id]
    );
    await recordAudit(connection, {
      actorId: req.user.id,
      action: 'hall.updated',
      entityType: 'hall',
      entityId: Number(id)
    });
    await connection.commit();

    return res.json({ message: 'Hall updated successfully.' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('updateHall error:', err);
    return res.status(500).json({ message: 'Could not update hall.' });
  } finally {
    if (connection) connection.release();
  }
}

// DELETE /api/admin/halls/:id -> remove a hall
async function deleteHall(req, res) {
  let connection;
  try {
    const { id } = req.params;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [existing] = await connection.query('SELECT id, is_active FROM halls WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Hall not found.' });
    }

    if (Boolean(existing[0].is_active)) {
      await connection.query('UPDATE halls SET is_active = 0 WHERE id = ?', [id]);
      await recordAudit(connection, {
        actorId: req.user.id,
        action: 'hall.deactivated',
        entityType: 'hall',
        entityId: Number(id)
      });
    }
    await connection.commit();
    return res.json({ message: 'Hall deactivated. Its booking history has been preserved.' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('deleteHall error:', err);
    return res.status(500).json({ message: 'Could not delete hall.' });
  } finally {
    if (connection) connection.release();
  }
}

function validHallInput(hall, isNew) {
  return typeof hall.name === 'string' && hall.name.trim().length > 0 && hall.name.trim().length <= 150 &&
    typeof hall.location === 'string' && hall.location.trim().length > 0 && hall.location.trim().length <= 200 &&
    Number.isFinite(Number(hall.price)) && Number(hall.price) >= 0 &&
    Number.isInteger(Number(hall.capacity)) && Number(hall.capacity) > 0 &&
    (!isNew || hall.price !== undefined && hall.capacity !== undefined) &&
    (!hall.description || typeof hall.description === 'string') &&
    (!hall.image || typeof hall.image === 'string' && hall.image.length <= 255) &&
    (!hall.facilities || typeof hall.facilities === 'string');
}

module.exports = {
  getAllHalls,
  getHallById,
  getHallAvailability,
  addHall,
  updateHall,
  deleteHall,
  validHallInput
};
