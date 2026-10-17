async function recordAudit(connection, { actorId, action, entityType, entityId = null, details = null }) {
  await connection.query(
    `INSERT INTO audit_events (actor_id, action, entity_type, entity_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [
      actorId || null,
      action,
      entityType,
      entityId,
      details === null ? null : JSON.stringify(details)
    ]
  );
}

module.exports = { recordAudit };
