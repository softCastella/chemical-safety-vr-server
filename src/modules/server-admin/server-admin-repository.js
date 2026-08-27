import { createHash, randomBytes, randomUUID } from "node:crypto";

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

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
  };
}
