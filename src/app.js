import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { databasePool } from "./db/pool.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createUserRepository } from "./modules/users/user-repository.js";
import { createUserRouter } from "./modules/users/user-routes.js";
import { createTrainingRegistrationRouter } from "./modules/training-registration/training-registration-routes.js";
import { createFileTrainingRegistrationRepository } from "./modules/training-registration/training-registration-repository.js";
import { createLocalTelemetryRouter } from "./modules/local-telemetry/local-telemetry-routes.js";
import { createLocalTelemetryRepository } from "./modules/local-telemetry/local-telemetry-repository.js";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const dashboardRoot = path.join(publicRoot, "dashboard");
const siteRoot = path.join(publicRoot, "site");

export function createApp({
  userRepository,
  enableUserCrud = env.enableUnauthenticatedUserCrud,
  trainingRegistrationRepository,
  enableTrainingRegistration = env.enableLocalTrainingRegistration,
  localTelemetryRepository,
  enableLocalTelemetryRead = env.enableLocalTelemetryRead,
} = {}) {
  const app = express();
  const resolvedUserRepository =
    userRepository ?? createUserRepository(databasePool);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "tyche-safety-training-server",
    });
  });

  if (enableUserCrud) {
    app.use(
      "/api/users",
      createUserRouter({ repository: resolvedUserRepository }),
    );
  }

  if (enableTrainingRegistration) {
    const resolvedTrainingRegistrationRepository =
      trainingRegistrationRepository ??
      createFileTrainingRegistrationRepository(env.localTrainingDataFile);
    app.use(
      "/api/training-registrations",
      createTrainingRegistrationRouter({
        repository: resolvedTrainingRegistrationRepository,
      }),
    );
  }

  if (enableLocalTelemetryRead) {
    const resolvedLocalTelemetryRepository =
      localTelemetryRepository ??
      createLocalTelemetryRepository(env.unityTelemetryDirectory);
    app.use(
      "/api/local-telemetry",
      createLocalTelemetryRouter({ repository: resolvedLocalTelemetryRepository }),
    );
  }

  app.use("/dashboard", express.static(dashboardRoot));
  app.use(express.static(siteRoot));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
