const userSelect = `
  SELECT
    id,
    participant_code,
    status,
    controller_guide_version_completed,
    play_count,
    created_at,
    last_seen_at,
    updated_at,
    deleted_at
  FROM users
`;

function mapIdentity(row) {
  return {
    id: String(row.id),
    provider: row.provider,
    providerUserId: row.provider_user_id,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUser(row, identities = []) {
  return {
    id: row.id,
    participantCode: row.participant_code,
    status: row.status,
    controllerGuideVersionCompleted:
      row.controller_guide_version_completed,
    playCount: row.play_count,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    identities,
  };
}

async function selectIdentities(executor, userId) {
  const [rows] = await executor.execute(
    `
      SELECT
        id,
        provider,
        provider_user_id,
        last_verified_at,
        created_at,
        updated_at
      FROM external_identities
      WHERE user_id = ?
      ORDER BY id
    `,
    [userId],
  );

  return rows.map(mapIdentity);
}

async function selectUserById(executor, userId) {
  const [rows] = await executor.execute(
    `${userSelect} WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [userId],
  );

  if (rows.length === 0) {
    return null;
  }

  const identities = await selectIdentities(executor, userId);
  return mapUser(rows[0], identities);
}

export function createUserRepository(pool) {
  return {
    async findById(userId) {
      return selectUserById(pool, userId);
    },

    async findByMetaUserId(metaUserId) {
      const [rows] = await pool.execute(
        `
          SELECT u.id
          FROM users AS u
          INNER JOIN external_identities AS identity
            ON identity.user_id = u.id
          WHERE identity.provider = 'meta'
            AND identity.provider_user_id = ?
            AND u.deleted_at IS NULL
          LIMIT 1
        `,
        [metaUserId],
      );

      return rows.length === 0 ? null : selectUserById(pool, rows[0].id);
    },

    async list({ limit, offset }) {
      const [rows] = await pool.execute(
        `${userSelect}
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
      );
      const [countRows] = await pool.query(
        "SELECT COUNT(*) AS total FROM users WHERE deleted_at IS NULL",
      );

      return {
        users: rows.map((row) => mapUser(row)),
        total: Number(countRows[0].total),
      };
    },

    async create({
      id,
      participantCode,
      metaUserId,
      controllerGuideVersionCompleted,
    }) {
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();
        await connection.execute(
          `
            INSERT INTO users (
              id,
              participant_code,
              controller_guide_version_completed
            ) VALUES (?, ?, ?)
          `,
          [id, participantCode, controllerGuideVersionCompleted],
        );
        await connection.execute(
          `
            INSERT INTO external_identities (
              user_id,
              provider,
              provider_user_id
            ) VALUES (?, 'meta', ?)
          `,
          [id, metaUserId],
        );
        await connection.commit();
        return await selectUserById(connection, id);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async update(userId, changes) {
      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();
        const assignments = [];
        const values = [];

        if (Object.hasOwn(changes, "status")) {
          assignments.push("status = ?");
          values.push(changes.status);
        }
        if (Object.hasOwn(changes, "controllerGuideVersionCompleted")) {
          assignments.push("controller_guide_version_completed = ?");
          values.push(changes.controllerGuideVersionCompleted);
        }

        if (assignments.length > 0) {
          values.push(userId);
          const [result] = await connection.execute(
            `UPDATE users SET ${assignments.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
            values,
          );

          if (result.affectedRows === 0) {
            await connection.rollback();
            return null;
          }
        }

        await connection.commit();
        return await selectUserById(connection, userId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async softDelete(userId) {
      const [result] = await pool.execute(
        `
          UPDATE users
          SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP(3)
          WHERE id = ? AND deleted_at IS NULL
        `,
        [userId],
      );

      return result.affectedRows > 0;
    },
  };
}
