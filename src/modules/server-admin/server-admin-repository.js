import { createHash, randomBytes, randomUUID } from "node:crypto";

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const endpointHash = (endpoint) => createHash("sha256").update(endpoint).digest("hex");

export function createServerAdminRepository(pool) {
  return {
    async findAccount(username) {
      const [rows] = await pool.execute(
        `SELECT id, username, password_hash, role, status, failed_login_count, locked_until, expires_at
         FROM server_admin_accounts WHERE username = ? LIMIT 1`, [username]);
      return rows[0] ?? null;
    },
    async recordFailure(adminId, ip) {
      if (adminId) await pool.execute(
        `UPDATE server_admin_accounts SET failed_login_count = failed_login_count + 1,
         locked_until = IF(failed_login_count + 1 >= 5, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 15 MINUTE), locked_until)
         WHERE id = ?`, [adminId]);
      await pool.execute(
        "INSERT INTO server_admin_audit_log (admin_id, event_type, ip_address) VALUES (?, 'login_failed', ?)",
        [adminId, ip]);
    },
    async createSession(admin, ip, userAgent) {
      const token = randomBytes(32).toString("base64url");
      const id = randomUUID();
      await pool.execute(
        `INSERT INTO server_admin_sessions
         (id, admin_id, token_hash, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 8 HOUR))`,
        [id, admin.id, tokenHash(token), ip, userAgent?.slice(0, 255) || null]);
      await pool.execute(
        "UPDATE server_admin_accounts SET failed_login_count = 0, locked_until = NULL, last_login_at = UTC_TIMESTAMP(3) WHERE id = ?",
        [admin.id]);
      await pool.execute(
        "INSERT INTO server_admin_audit_log (admin_id, event_type, ip_address) VALUES (?, 'login_succeeded', ?)",
        [admin.id, ip]);
      return token;
    },
    async findSession(token) {
      if (!token) return null;
      const [rows] = await pool.execute(
        `SELECT s.id, s.admin_id, a.username, a.role FROM server_admin_sessions s
         JOIN server_admin_accounts a ON a.id = s.admin_id
         WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(3)
         AND a.status = 'active' AND (a.expires_at IS NULL OR a.expires_at > UTC_TIMESTAMP(3)) LIMIT 1`, [tokenHash(token)]);
      return rows[0] ?? null;
    },
    async revokeSession(token) {
      if (token) await pool.execute(
        "UPDATE server_admin_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE token_hash = ?", [tokenHash(token)]);
    },
    async recentSecurityEvents() {
      const [rows] = await pool.execute(
        `SELECT id, event_type AS eventType, ip_address AS ipAddress, created_at AS createdAt
         FROM server_admin_audit_log WHERE event_type = 'login_failed'
         ORDER BY created_at DESC LIMIT 20`);
      return rows;
    },
    async listSecurityEvents({ page, pageSize = 20 }) {
      const offset = (page - 1) * pageSize;
      const [[countRow]] = await pool.execute(
        "SELECT COUNT(*) AS count FROM server_admin_audit_log WHERE event_type = 'login_failed'");
      const [rows] = await pool.execute(
        `SELECT id, event_type AS eventType, ip_address AS ipAddress, created_at AS createdAt
         FROM server_admin_audit_log WHERE event_type = 'login_failed'
         ORDER BY created_at DESC LIMIT ? OFFSET ?`, [pageSize, offset]);
      return { items: rows, total: Number(countRow.count), page, pageSize };
    },
    async deleteSecurityEvents(ids) {
      const placeholders = ids.map(() => "?").join(", ");
      const [result] = await pool.execute(
        `DELETE FROM server_admin_audit_log WHERE event_type = 'login_failed' AND id IN (${placeholders})`, ids);
      return result.affectedRows;
    },
    async listTrustedIps() {
      const [rows] = await pool.execute(
        "SELECT id, label, cidr, enabled, created_at AS createdAt FROM server_admin_allowed_ips ORDER BY id");
      return rows;
    },
    async addTrustedIp({ label, cidr, adminId }) {
      const [result] = await pool.execute(
        "INSERT INTO server_admin_allowed_ips (label, cidr, created_by) VALUES (?, ?, ?)",
        [label, cidr, adminId]);
      return result.insertId;
    },
    async removeTrustedIp(id) {
      const [countRows] = await pool.execute("SELECT COUNT(*) AS count FROM server_admin_allowed_ips WHERE enabled = TRUE");
      if (Number(countRows[0].count) <= 1) return false;
      const [result] = await pool.execute("DELETE FROM server_admin_allowed_ips WHERE id = ?", [id]);
      return result.affectedRows === 1;
    },
    async savePushSubscription({ adminId, endpoint, p256dh, auth, userAgent }) {
      const id = randomUUID();
      await pool.execute(
        `INSERT INTO server_admin_push_subscriptions
         (id, admin_id, endpoint_hash, endpoint, p256dh, auth, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE admin_id = VALUES(admin_id), endpoint = VALUES(endpoint),
         p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent),
         updated_at = UTC_TIMESTAMP(3)`,
        [id, adminId, endpointHash(endpoint), endpoint, p256dh, auth, userAgent?.slice(0, 255) || null],
      );
      return { id };
    },
    async removePushSubscription({ adminId, endpoint }) {
      const [result] = await pool.execute(
        "DELETE FROM server_admin_push_subscriptions WHERE admin_id = ? AND endpoint_hash = ?",
        [adminId, endpointHash(endpoint)],
      );
      return result.affectedRows > 0;
    },
    async listPushSubscriptions() {
      const [rows] = await pool.execute(
        `SELECT id, endpoint, p256dh, auth
         FROM server_admin_push_subscriptions ORDER BY updated_at DESC`,
      );
      return rows;
    },
    async markPushSubscriptionSucceeded(id) {
      await pool.execute(
        "UPDATE server_admin_push_subscriptions SET last_success_at = UTC_TIMESTAMP(3) WHERE id = ?",
        [id],
      );
    },
    async removePushSubscriptionById(id) {
      await pool.execute("DELETE FROM server_admin_push_subscriptions WHERE id = ?", [id]);
    },
    async getAlertMonitorState() {
      await pool.execute(
        `INSERT IGNORE INTO server_admin_alert_monitor_state
         (id, initialized, last_security_event_id) VALUES (1, FALSE, 0)`,
      );
      const [rows] = await pool.execute(
        `SELECT initialized, last_security_event_id AS lastSecurityEventId
         FROM server_admin_alert_monitor_state WHERE id = 1`,
      );
      return rows[0] ?? { initialized: 0, lastSecurityEventId: 0 };
    },
    async initializeAlertMonitor({ alerts, securityEvents }) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const occurrences = [
          ...alerts.map((alert) => ({ ...alert, source: "system" })),
          ...securityEvents.map((event) => ({ ...event, source: "security" })),
        ];
        for (const occurrence of occurrences) {
          await connection.execute(
            `INSERT INTO server_admin_alert_occurrences
             (alert_key, generation, source, message, active, push_processed_at)
             VALUES (?, 1, ?, ?, TRUE, UTC_TIMESTAMP(3))
             ON DUPLICATE KEY UPDATE message = VALUES(message), active = TRUE,
             last_seen_at = UTC_TIMESTAMP(3), resolved_at = NULL,
             push_processed_at = COALESCE(push_processed_at, UTC_TIMESTAMP(3))`,
            [occurrence.key, occurrence.source, occurrence.message],
          );
          await connection.execute(
            `INSERT IGNORE INTO server_admin_alert_acknowledgements
             (admin_id, alert_key, generation)
             SELECT id, ?, 1 FROM server_admin_accounts WHERE status = 'active'`,
            [occurrence.key],
          );
        }
        const lastSecurityEventId = securityEvents.reduce(
          (maximum, event) => Math.max(maximum, Number(event.eventId) || 0),
          0,
        );
        await connection.execute(
          `UPDATE server_admin_alert_monitor_state
           SET initialized = TRUE, last_security_event_id = ?, updated_at = UTC_TIMESTAMP(3)
           WHERE id = 1`,
          [lastSecurityEventId],
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async syncSystemAlertOccurrences(alerts) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute(
          `SELECT alert_key AS alertKey, generation, active
           FROM server_admin_alert_occurrences WHERE source = 'system' FOR UPDATE`,
        );
        const existing = new Map(rows.map((row) => [row.alertKey, row]));
        const activeKeys = new Set(alerts.map((alert) => alert.key));
        for (const alert of alerts) {
          const current = existing.get(alert.key);
          if (!current) {
            await connection.execute(
              `INSERT INTO server_admin_alert_occurrences
               (alert_key, generation, source, message, active)
               VALUES (?, 1, 'system', ?, TRUE)`,
              [alert.key, alert.message],
            );
          } else if (!current.active) {
            await connection.execute(
              `UPDATE server_admin_alert_occurrences
               SET generation = generation + 1, message = ?, active = TRUE,
               first_seen_at = UTC_TIMESTAMP(3), last_seen_at = UTC_TIMESTAMP(3),
               resolved_at = NULL, push_processed_at = NULL WHERE alert_key = ?`,
              [alert.message, alert.key],
            );
          } else {
            await connection.execute(
              `UPDATE server_admin_alert_occurrences
               SET message = ?, last_seen_at = UTC_TIMESTAMP(3) WHERE alert_key = ?`,
              [alert.message, alert.key],
            );
          }
        }
        for (const row of rows) {
          if (row.active && !activeKeys.has(row.alertKey)) {
            await connection.execute(
              `UPDATE server_admin_alert_occurrences
               SET active = FALSE, resolved_at = UTC_TIMESTAMP(3) WHERE alert_key = ?`,
              [row.alertKey],
            );
          }
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async listSecurityEventsAfter(id) {
      const [rows] = await pool.execute(
        `SELECT id, ip_address AS ipAddress, created_at AS createdAt
         FROM server_admin_audit_log
         WHERE event_type = 'login_failed' AND id > ? ORDER BY id ASC`,
        [id],
      );
      return rows;
    },
    async syncSecurityAlertOccurrences(events) {
      for (const event of events) {
        await pool.execute(
          `INSERT IGNORE INTO server_admin_alert_occurrences
           (alert_key, generation, source, message, active)
           VALUES (?, 1, 'security', ?, TRUE)`,
          [event.key, event.message],
        );
      }
      if (events.length > 0) {
        const lastId = Math.max(...events.map((event) => Number(event.eventId) || 0));
        await pool.execute(
          `UPDATE server_admin_alert_monitor_state
           SET last_security_event_id = ?, updated_at = UTC_TIMESTAMP(3) WHERE id = 1`,
          [lastId],
        );
      }
    },
    async listPendingAlertOccurrences() {
      const [rows] = await pool.execute(
        `SELECT alert_key AS alertKey, generation, source, message
         FROM server_admin_alert_occurrences
         WHERE active = TRUE AND push_processed_at IS NULL
         ORDER BY first_seen_at ASC`,
      );
      return rows;
    },
    async markAlertOccurrencesPushProcessed(occurrences) {
      for (const occurrence of occurrences) {
        await pool.execute(
          `UPDATE server_admin_alert_occurrences SET push_processed_at = UTC_TIMESTAMP(3)
           WHERE alert_key = ? AND generation = ?`,
          [occurrence.alertKey, occurrence.generation],
        );
      }
    },
    async listAlertOccurrenceGenerations(keys) {
      if (keys.length === 0) return new Map();
      const placeholders = keys.map(() => "?").join(", ");
      const [rows] = await pool.execute(
        `SELECT alert_key AS alertKey, generation
         FROM server_admin_alert_occurrences WHERE alert_key IN (${placeholders})`,
        keys,
      );
      return new Map(rows.map((row) => [row.alertKey, Number(row.generation)]));
    },
    async listAcknowledgedAlertOccurrences(adminId, keys) {
      if (keys.length === 0) return [];
      const placeholders = keys.map(() => "?").join(", ");
      const [rows] = await pool.execute(
        `SELECT alert_key AS alertKey, generation
         FROM server_admin_alert_acknowledgements
         WHERE admin_id = ? AND alert_key IN (${placeholders})`,
        [adminId, ...keys],
      );
      return rows.map((row) => `${row.alertKey}@${row.generation}`);
    },
    async acknowledgeAlertOccurrences(adminId, occurrences) {
      for (const occurrence of occurrences) {
        await pool.execute(
          `INSERT IGNORE INTO server_admin_alert_acknowledgements
           (admin_id, alert_key, generation) VALUES (?, ?, ?)`,
          [adminId, occurrence.alertKey, occurrence.generation],
        );
      }
    },
  };
}
