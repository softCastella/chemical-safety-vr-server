import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { databasePool } from "./pool.js";

const migrationsDirectory = fileURLToPath(
  new URL("../../db/migrations/", import.meta.url),
);

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (name)
    ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

async function loadAppliedMigrations(connection) {
  const [rows] = await connection.query(
    "SELECT name FROM schema_migrations ORDER BY name",
  );

  return new Set(rows.map((row) => row.name));
}

async function migrate() {
  const connection = await databasePool.getConnection();

  try {
    await ensureMigrationTable(connection);
    const applied = await loadAppliedMigrations(connection);
    const migrationNames = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const name of migrationNames) {
      if (applied.has(name)) {
        console.log(`Migration already applied: ${name}`);
        continue;
      }

      const sql = await readFile(path.join(migrationsDirectory, name), "utf8");

      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.execute(
          "INSERT INTO schema_migrations (name) VALUES (?)",
          [name],
        );
        await connection.commit();
        console.log(`Migration applied: ${name}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    connection.release();
  }
}

try {
  await migrate();
} catch (error) {
  console.error("Database migration failed.", error);
  process.exitCode = 1;
} finally {
  await databasePool.end();
}
