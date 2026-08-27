import { randomInt } from "node:crypto";
import { databasePool } from "../src/db/pool.js";
import { hashPassword } from "../src/modules/server-admin/password.js";

const username = "tyche_viewer";
const pin = String(randomInt(0, 10000)).padStart(4, "0");
try {
  const passwordHash = await hashPassword(pin, { minimumLength: 4 });
  await databasePool.execute(
    `INSERT INTO server_admin_accounts (username, password_hash, role, status, expires_at)
     VALUES (?, ?, 'viewer', 'active', DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 HOUR))
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'viewer', status = 'active',
       failed_login_count = 0, locked_until = NULL, expires_at = VALUES(expires_at)`,
    [username, passwordHash],
  );
  console.log(`VIEWER_ID=${username}`);
  console.log(`TEMPORARY_PIN=${pin}`);
  console.log("EXPIRES_IN=1 hour");
} finally {
  await databasePool.end();
}
