import { stdin } from "node:process";

import { databasePool } from "../src/db/pool.js";
import { hashPassword } from "../src/modules/server-admin/password.js";

const username = process.argv[2];
const role = process.argv[3] ?? "admin";
if (!/^[a-z0-9_]{4,64}$/.test(username ?? "")) {
  console.error("Username must be 4-64 lowercase letters, numbers, or underscores.");
  process.exit(1);
}
if (!new Set(["admin", "viewer"]).has(role)) {
  console.error("Role must be admin or viewer.");
  process.exit(1);
}

let password = "";
stdin.setEncoding("utf8");
for await (const chunk of stdin) password += chunk;
password = password.replace(/[\r\n]+$/, "");

try {
  const passwordHash = await hashPassword(password);
  const [result] = await databasePool.execute(
    `INSERT INTO server_admin_accounts (username, password_hash, role)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash),
       role = VALUES(role), status = 'active', failed_login_count = 0, locked_until = NULL`,
    [username, passwordHash, role],
  );
  console.log(result.affectedRows === 1 ? "Administrator created." : "Administrator password updated.");
} finally {
  password = "";
  await databasePool.end();
}
