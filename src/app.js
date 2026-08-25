import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { databasePool } from "./db/pool.js";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createUserRepository } from "./modules/users/user-repository.js";
import { createUserRouter } from "./modules/users/user-routes.js";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const dashboardRoot = path.join(publicRoot, "dashboard");
const siteRoot = path.join(publicRoot, "site");

export function createApp({
  userRepository,
  enableUserCrud = env.enableUnauthenticatedUserCrud,
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

  app.use("/dashboard", express.static(dashboardRoot));
  app.use(express.static(siteRoot));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
