import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { databasePool } from "./db/pool.js";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`Tyche server listening on http://localhost:${env.port}`);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${signal} received. Closing HTTP server.`);

  server.close(async (error) => {
    if (error) {
      console.error("Failed to close HTTP server cleanly.", error);
      process.exitCode = 1;
    }

    try {
      await databasePool.end();
    } catch (databaseError) {
      console.error("Failed to close the database pool cleanly.", databaseError);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
