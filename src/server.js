import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { databasePool } from "./db/pool.js";
import { createServerAdminRepository } from "./modules/server-admin/server-admin-repository.js";
import { createServerAdminPushService } from "./modules/server-admin/server-admin-push.js";
import { createServerAlertMonitor } from "./modules/server-admin/server-alert-monitor.js";
import { createStarlightAnalyticsRepository } from "./modules/starlight-analytics/starlight-analytics-repository.js";
import { createStarlightAnalyticsRetentionMonitor } from "./modules/starlight-analytics/starlight-analytics-retention.js";

const serverAdminRepository = env.enableServerAdmin
  ? createServerAdminRepository(databasePool)
  : undefined;
const serverAdminPushService = env.enableServerAdmin
  ? createServerAdminPushService(env.serverAdminPush)
  : undefined;
const serverAlertMonitor = env.enableServerAdmin
  ? createServerAlertMonitor({
      repository: serverAdminRepository,
      pushService: serverAdminPushService,
      intervalMs: env.serverAdminPush.pollIntervalSeconds * 1000,
    })
  : undefined;
const starlightAnalyticsRepository = env.enableStarlightAnalyticsIngest || env.enableServerAdmin
  ? createStarlightAnalyticsRepository(databasePool)
  : undefined;
const starlightAnalyticsRetentionMonitor = env.enableStarlightAnalyticsIngest
  ? createStarlightAnalyticsRetentionMonitor({
      repository: starlightAnalyticsRepository,
      retentionDays: env.starlightAnalyticsRetentionDays,
      intervalMs: env.starlightAnalyticsCleanupIntervalSeconds * 1000,
    })
  : undefined;

const app = createApp({
  serverAdminRepository,
  serverAdminPushService,
  starlightAnalyticsRepository,
});

const server = app.listen(env.port, () => {
  console.log(`Tyche server listening on http://localhost:${env.port}`);
  serverAlertMonitor?.start().catch((error) => {
    console.error("Failed to start server alert monitor.", {
      code: error?.code ?? "UNKNOWN",
      message: error?.message ?? "Unknown error",
    });
  });
  starlightAnalyticsRetentionMonitor?.start().catch((error) => {
    console.error("Failed to start Starlight analytics retention monitor.", {
      code: error?.code ?? "UNKNOWN",
      message: error?.message ?? "Unknown error",
    });
  });
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${signal} received. Closing HTTP server.`);
  serverAlertMonitor?.stop();
  starlightAnalyticsRetentionMonitor?.stop();

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
