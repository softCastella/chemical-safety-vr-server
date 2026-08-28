import { createHash } from "node:crypto";

import { conflict, notFound } from "../../lib/app-error.js";

function toIsoString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapSession(row) {
  return {
    sessionId: row.session_id,
    schemaVersion: Number(row.schema_version),
    sourceProject: row.source_project,
    participantId: Number(row.participant_id),
    status: row.status,
    startedAtUtc: toIsoString(row.started_at),
    endedAtUtc: toIsoString(row.ended_at),
    endReason: row.end_reason,
    appVersion: row.app_version,
    scene: row.scene,
    mode: row.mode,
    workPlan: row.work_plan,
    eventCount: row.event_count === undefined ? undefined : Number(row.event_count),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function payloadFor(event) {
  return JSON.stringify(event);
}

function payloadHash(payloadJson) {
  return createHash("sha256").update(payloadJson).digest("hex");
}

async function selectSession(executor, sessionId, lock = false) {
  const [rows] = await executor.execute(
    `
      SELECT
        session_id,
        schema_version,
        source_project,
        participant_id,
        status,
        started_at,
        ended_at,
        end_reason,
        app_version,
        scene,
        mode,
        work_plan,
        created_at,
        updated_at
      FROM training_telemetry_sessions
      WHERE session_id = ?
      LIMIT 1
      ${lock ? "FOR UPDATE" : ""}
    `,
    [sessionId],
  );
  return rows.length === 0 ? null : mapSession(rows[0]);
}

function sameNullable(left, right) {
  return (left ?? null) === (right ?? null);
}

function assertSameSession(existing, requested) {
  const same = existing.schemaVersion === requested.schemaVersion &&
    existing.sourceProject === requested.sourceProject &&
    existing.participantId === requested.participantId &&
    existing.startedAtUtc === requested.startedAtUtc &&
    sameNullable(existing.appVersion, requested.appVersion) &&
    sameNullable(existing.scene, requested.scene) &&
    sameNullable(existing.mode, requested.mode) &&
    sameNullable(existing.workPlan, requested.workPlan);
  if (!same) {
    throw conflict("sessionId is already used by a different session payload.");
  }
}

function mapParticipant(row) {
  const identityTypes = typeof row.identity_types === "string" && row.identity_types.length > 0
    ? row.identity_types.split(",")
    : [];
  return {
    participantId: Number(row.participant_id),
    sourceProject: row.source_project,
    identityType: identityTypes.includes("meta") ? "meta" : "anonymous",
    identityTypes,
    sessionCount: Number(row.session_count ?? 0),
    firstSeenAt: toIsoString(row.first_seen_at),
    lastSeenAt: toIsoString(row.last_seen_at),
  };
}

async function resolveParticipant(executor, session) {
  const identityType = session.metaUserId ? "meta" : "anonymous";
  const identityValue = session.metaUserId ?? session.clientInstanceId;
  const [rows] = await executor.execute(
    `
      SELECT participant.participant_id
      FROM training_telemetry_identities AS identity
      INNER JOIN training_telemetry_participants AS participant
        ON participant.participant_id = identity.participant_id
      WHERE identity.source_project = ?
        AND identity.identity_type = ?
        AND identity.identity_value = ?
      LIMIT 1
      FOR UPDATE
    `,
    [session.sourceProject, identityType, identityValue],
  );
  if (rows.length > 0) {
    const participantId = Number(rows[0].participant_id);
    await executor.execute(
      `UPDATE training_telemetry_participants
       SET last_seen_at = CURRENT_TIMESTAMP(6)
       WHERE participant_id = ?`,
      [participantId],
    );
    return participantId;
  }

  const [participantResult] = await executor.execute(
    `INSERT INTO training_telemetry_participants (source_project)
     VALUES (?)`,
    [session.sourceProject],
  );
  const participantId = Number(participantResult.insertId);
  await executor.execute(
    `
      INSERT INTO training_telemetry_identities (
        participant_id,
        source_project,
        identity_type,
        identity_value
      ) VALUES (?, ?, ?, ?)
    `,
    [participantId, session.sourceProject, identityType, identityValue],
  );
  return participantId;
}

function acceptedThrough(rows) {
  let expected = 1;
  for (const row of rows) {
    const sequence = Number(row.sequence);
    if (sequence !== expected) {
      break;
    }
    expected += 1;
  }
  return expected - 1;
}

export function createTrainingTelemetryRepository(pool) {
  return {
    async createSession(session) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const participantId = await resolveParticipant(connection, session);
        const requested = { ...session, participantId };
        const existing = await selectSession(connection, session.sessionId, true);
        if (existing) {
          assertSameSession(existing, requested);
          await connection.commit();
          return { ...existing, created: false };
        }

        await connection.execute(
          `
            INSERT INTO training_telemetry_sessions (
              session_id,
              schema_version,
              source_project,
              participant_id,
              started_at,
              app_version,
              scene,
              mode,
              work_plan
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            session.sessionId,
            session.schemaVersion,
            session.sourceProject,
            participantId,
            new Date(session.startedAtUtc),
            session.appVersion,
            session.scene,
            session.mode,
            session.workPlan,
          ],
        );
        const created = await selectSession(connection, session.sessionId);
        await connection.commit();
        return { ...created, created: true };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async saveEvents(sessionId, events) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const session = await selectSession(connection, sessionId, true);
        if (!session) {
          throw notFound("Training telemetry session not found.");
        }
        if (session.status !== "open") {
          throw conflict("Completed training telemetry sessions cannot accept new events.");
        }

        let accepted = 0;
        let duplicates = 0;
        for (const event of events) {
          const payloadJson = payloadFor(event);
          const sha256 = payloadHash(payloadJson);
          try {
            await connection.execute(
              `
                INSERT INTO training_telemetry_events (
                  session_id,
                  event_id,
                  sequence,
                  schema_version,
                  timestamp_utc,
                  event_type,
                  payload_json,
                  payload_sha256
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                sessionId,
                event.eventId,
                event.sequence,
                event.schemaVersion,
                new Date(event.timestampUtc),
                event.eventType,
                payloadJson,
                sha256,
              ],
            );
            accepted += 1;
          } catch (error) {
            if (error?.code !== "ER_DUP_ENTRY") {
              throw error;
            }
            const [rows] = await connection.execute(
              `
                SELECT session_id, event_id, sequence, payload_sha256
                FROM training_telemetry_events
                WHERE event_id = ? OR (session_id = ? AND sequence = ?)
                FOR UPDATE
              `,
              [event.eventId, sessionId, event.sequence],
            );
            const exactDuplicate = rows.some((row) =>
              row.session_id === sessionId &&
              row.event_id === event.eventId &&
              Number(row.sequence) === event.sequence &&
              row.payload_sha256 === sha256);
            if (!exactDuplicate) {
              throw conflict("eventId or sequence is already used by different event data.");
            }
            duplicates += 1;
          }
        }

        const [sequenceRows] = await connection.execute(
          `
            SELECT sequence
            FROM training_telemetry_events
            WHERE session_id = ?
            ORDER BY sequence
          `,
          [sessionId],
        );
        const result = {
          accepted,
          duplicates,
          rejected: 0,
          acceptedThroughSequence: acceptedThrough(sequenceRows),
        };
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async completeSession(sessionId, completion) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const session = await selectSession(connection, sessionId, true);
        if (!session) {
          throw notFound("Training telemetry session not found.");
        }
        if (session.schemaVersion !== completion.schemaVersion) {
          throw conflict("schemaVersion does not match the existing session.");
        }
        if (Date.parse(completion.endedAtUtc) < Date.parse(session.startedAtUtc)) {
          throw conflict("endedAtUtc must not be earlier than startedAtUtc.");
        }
        if (session.status === "completed") {
          const same = session.endedAtUtc === completion.endedAtUtc &&
            session.endReason === completion.reason;
          if (!same) {
            throw conflict("The session is already completed with different data.");
          }
          await connection.commit();
          return session;
        }

        await connection.execute(
          `
            UPDATE training_telemetry_sessions
            SET status = 'completed', ended_at = ?, end_reason = ?
            WHERE session_id = ?
          `,
          [new Date(completion.endedAtUtc), completion.reason, sessionId],
        );
        const completed = await selectSession(connection, sessionId);
        await connection.commit();
        return completed;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async listSessions({ limit, participantId }) {
      const where = participantId === null ? "" : "WHERE session.participant_id = ?";
      const values = participantId === null ? [limit] : [participantId, limit];
      const [rows] = await pool.execute(
        `
          SELECT
            session.session_id,
            session.schema_version,
            session.source_project,
            session.participant_id,
            session.status,
            session.started_at,
            session.ended_at,
            session.end_reason,
            session.app_version,
            session.scene,
            session.mode,
            session.work_plan,
            session.created_at,
            session.updated_at,
            COUNT(event.id) AS event_count
          FROM training_telemetry_sessions AS session
          LEFT JOIN training_telemetry_events AS event
            ON event.session_id = session.session_id
          ${where}
          GROUP BY session.session_id
          ORDER BY session.started_at DESC, session.session_id DESC
          LIMIT ?
        `,
        values,
      );
      return rows.map(mapSession);
    },

    async findSession(sessionId) {
      const session = await selectSession(pool, sessionId);
      if (!session) {
        return null;
      }
      const [rows] = await pool.execute(
        `
          SELECT payload_json
          FROM training_telemetry_events
          WHERE session_id = ?
          ORDER BY sequence
        `,
        [sessionId],
      );
      const events = rows.map((row) =>
        typeof row.payload_json === "string"
          ? JSON.parse(row.payload_json)
          : row.payload_json);
      return { ...session, eventCount: events.length, events };
    },

    async listParticipants(limit) {
      const [rows] = await pool.execute(
        `
          SELECT
            participant.participant_id,
            participant.source_project,
            participant.first_seen_at,
            participant.last_seen_at,
            GROUP_CONCAT(DISTINCT identity.identity_type ORDER BY identity.identity_type) AS identity_types,
            COUNT(DISTINCT session.session_id) AS session_count
          FROM training_telemetry_participants AS participant
          INNER JOIN training_telemetry_identities AS identity
            ON identity.participant_id = participant.participant_id
          LEFT JOIN training_telemetry_sessions AS session
            ON session.participant_id = participant.participant_id
          GROUP BY participant.participant_id
          ORDER BY participant.participant_id DESC
          LIMIT ?
        `,
        [limit],
      );
      return rows.map(mapParticipant);
    },

    async findParticipant(participantId) {
      const [rows] = await pool.execute(
        `
          SELECT
            participant.participant_id,
            participant.source_project,
            participant.first_seen_at,
            participant.last_seen_at,
            GROUP_CONCAT(DISTINCT identity.identity_type ORDER BY identity.identity_type) AS identity_types,
            COUNT(DISTINCT session.session_id) AS session_count
          FROM training_telemetry_participants AS participant
          INNER JOIN training_telemetry_identities AS identity
            ON identity.participant_id = participant.participant_id
          LEFT JOIN training_telemetry_sessions AS session
            ON session.participant_id = participant.participant_id
          WHERE participant.participant_id = ?
          GROUP BY participant.participant_id
          LIMIT 1
        `,
        [participantId],
      );
      if (rows.length === 0) return null;
      const participant = mapParticipant(rows[0]);
      const sessions = await this.listSessions({ limit: 100, participantId });
      return { ...participant, sessions };
    },
  };
}
