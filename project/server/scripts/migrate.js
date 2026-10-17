require('dotenv').config();
const { pool } = require('../db');

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function indexExists(connection, table, index) {
  const [rows] = await connection.query(
    `SELECT 1 FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, index]
  );
  return rows.length > 0;
}

async function migrate({ closePool = false } = {}) {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const [rolesMigration] = await connection.query(
      'SELECT version FROM schema_migrations WHERE version = ?',
      ['001_roles_managers']
    );

    if (rolesMigration.length === 0) {
      const additions = [
        ['users', 'is_active', 'ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1'],
        ['users', 'email_verified_at', 'ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL DEFAULT NULL'],
        ['halls', 'facilities', 'ALTER TABLE halls ADD COLUMN facilities TEXT NULL'],
        ['halls', 'is_active', 'ALTER TABLE halls ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1']
      ];
      for (const [table, column, statement] of additions) {
        if (!(await columnExists(connection, table, column))) await connection.query(statement);
      }

      await connection.query(
        `ALTER TABLE users
         MODIFY COLUMN role ENUM('user', 'admin', 'manager', 'owner') NOT NULL DEFAULT 'user'`
      );
      await connection.query(
        `ALTER TABLE bookings
         MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending'`
      );
      await connection.query(`
      CREATE TABLE IF NOT EXISTS manager_halls (
        manager_id INT NOT NULL,
        hall_id INT NOT NULL,
        can_edit_price TINYINT(1) NOT NULL DEFAULT 0,
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (manager_id, hall_id),
        CONSTRAINT fk_manager_halls_manager
          FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_manager_halls_hall
          FOREIGN KEY (hall_id) REFERENCES halls(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

      if (!(await indexExists(connection, 'bookings', 'idx_bookings_hall_date_status'))) {
        await connection.query(
          'CREATE INDEX idx_bookings_hall_date_status ON bookings (hall_id, date, status)'
        );
      }
      if (!(await indexExists(connection, 'users', 'idx_users_role_active_created'))) {
        await connection.query(
          'CREATE INDEX idx_users_role_active_created ON users (role, is_active, created_at)'
        );
      }

      await connection.query(
        'INSERT INTO schema_migrations (version) VALUES (?)',
        ['001_roles_managers']
      );
      console.log('Migration 001_roles_managers applied successfully.');
    } else {
      console.log('Migration 001_roles_managers is already applied.');
    }

    const [auditMigration] = await connection.query(
      'SELECT version FROM schema_migrations WHERE version = ?',
      ['002_audit_events']
    );
    if (auditMigration.length === 0) {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS audit_events (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          actor_id INT NULL,
          action VARCHAR(80) NOT NULL,
          entity_type VARCHAR(40) NOT NULL,
          entity_id BIGINT UNSIGNED NULL,
          details JSON NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_created (created_at, id),
          INDEX idx_audit_entity (entity_type, entity_id),
          CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id)
            REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB
      `);
      await connection.query(
        'INSERT INTO schema_migrations (version) VALUES (?)',
        ['002_audit_events']
      );
      console.log('Migration 002_audit_events applied successfully.');
    } else {
      console.log('Migration 002_audit_events is already applied.');
    }
    return true;
  } finally {
    connection.release();
    if (closePool) {
      await pool.end();
    }
  }
}

if (require.main === module) {
  migrate({ closePool: true }).catch(async (err) => {
    console.error('Database migration failed:', err.message);
    await pool.end();
    process.exitCode = 1;
  });
}

module.exports = { migrate, columnExists, indexExists };
