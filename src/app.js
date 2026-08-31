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
import { createServerAdminRepository } from "./modules/server-admin/server-admin-repository.js";
import { createServerAdminRouter } from "./modules/server-admin/server-admin-routes.js";
import { createServerAdminPushService } from "./modules/server-admin/server-admin-push.js";
import { createGeoLiteCountryLookup } from "./modules/server-admin/server-admin-geoip.js";
import { createTrainingTelemetryTokenAuthorizer } from "./modules/training-telemetry/training-telemetry-auth.js";
import { createTrainingTelemetryRepository } from "./modules/training-telemetry/training-telemetry-repository.js";
import { createTrainingTelemetryRouter } from "./modules/training-telemetry/training-telemetry-routes.js";
import { createContactRouter } from "./modules/contact/contact-routes.js";
import { createResendContactMailer } from "./modules/contact/resend-contact-mailer.js";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const dashboardRoot = path.join(publicRoot, "dashboard");
const siteRoot = path.join(publicRoot, "site");
const chemicalSafetyTrainingRoot = path.join(
  siteRoot,
  "immersa",
  "chemical-safety-training",
);
const serverStatusRoot = path.join(publicRoot, "server-status");
const telemetryIngestTestRoot = path.join(publicRoot, "telemetry-ingest-test");

export function createApp({
  userRepository,
  enableUserCrud = env.enableUnauthenticatedUserCrud,
  trainingRegistrationRepository,
  enableTrainingRegistration = env.enableLocalTrainingRegistration,
  localTelemetryRepository,
  enableLocalTelemetryRead = env.enableLocalTelemetryRead,
  trainingTelemetryRepository,
  enableTrainingTelemetryIngest = env.enableTrainingTelemetryIngest,
  trainingTelemetryUploadToken = env.trainingTelemetryUploadToken,
  serverAdminRepository,
  serverAdminPushService,
  geoLiteCountryLookup,
  enableServerAdmin = env.enableServerAdmin,
  contactMailer,
  enableContactForm = env.enableContactForm,
  contactRateLimitPerHour = env.contact.rateLimitPerHour,
  kakaoJavaScriptKey = env.kakaoJavaScriptKey,
} = {}) {
  const app = express();
  const resolvedUserRepository =
    userRepository ?? createUserRepository(databasePool);

  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "tyche-safety-training-server",
    });
  });

  app.get("/api/public-site-config", (_request, response) => {
    response.set("Cache-Control", "no-store");

    if (!kakaoJavaScriptKey) {
      response.status(503).json({
        code: "KAKAO_SHARE_UNAVAILABLE",
        message: "KAKAO_JAVASCRIPT_KEY is not configured.",
      });
      return;
    }

    response.status(200).json({ kakaoJavaScriptKey });
  });

  if (enableContactForm) {
    const resolvedContactMailer =
      contactMailer ??
      createResendContactMailer({
        apiKey: env.contact.resendApiKey,
        fromEmail: env.contact.fromEmail,
        toEmail: env.contact.toEmail,
      });
    app.use(
      "/api/contact",
      createContactRouter({
        mailer: resolvedContactMailer,
        rateLimitPerHour: contactRateLimitPerHour,
      }),
    );
  }

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

  if (enableTrainingTelemetryIngest) {
    const resolvedTrainingTelemetryRepository =
      trainingTelemetryRepository ?? createTrainingTelemetryRepository(databasePool);
    const authorize = createTrainingTelemetryTokenAuthorizer(
      trainingTelemetryUploadToken,
    );
    app.use(
      "/api/training-telemetry",
      createTrainingTelemetryRouter({
        repository: resolvedTrainingTelemetryRepository,
        authorize,
      }),
    );
    app.get(
      ["/telemetry-ingest-test", "/telemetry-ingest-test/"],
      (_request, response) =>
        response.sendFile(path.join(telemetryIngestTestRoot, "index.html")),
    );
  }

  if (enableServerAdmin) {
    const resolvedAdminRepository = serverAdminRepository ?? createServerAdminRepository(databasePool);
    const resolvedPushService = serverAdminPushService ?? createServerAdminPushService(env.serverAdminPush);
    const resolvedGeoLiteCountryLookup = geoLiteCountryLookup ?? createGeoLiteCountryLookup({ databasePath: env.geoLiteCountryDatabasePath });
    const { router, requireAdmin } = createServerAdminRouter({ repository: resolvedAdminRepository, pushService: resolvedPushService, geoLiteCountryLookup: resolvedGeoLiteCountryLookup });
    app.use("/api/server-status", router);
    app.get("/server-status/login", (_request, response) => response.sendFile(path.join(serverStatusRoot, "login.html")));
    app.get("/server-status/login.html", (_request, response) => response.redirect(308, "/server-status/login"));
    for (const asset of ["status.css", "controls.css", "login.js", "dashboard.js", "push-worker.js", "manifest.webmanifest"]) {
      app.get(`/server-status/${asset}`, (_request, response) => response.sendFile(path.join(serverStatusRoot, asset)));
    }
    app.get("/server-status/favicon.svg", (_request, response) => response.sendFile(path.join(siteRoot, "assets", "favicon_round_crop.svg")));
    app.get(["/server-status", "/server-status/"], requireAdmin, (_request, response) => response.sendFile(path.join(serverStatusRoot, "index.html")));
  }

  app.use("/dashboard", express.static(dashboardRoot));
  app.use(
    "/chemical-safety-training",
    express.static(chemicalSafetyTrainingRoot),
  );
  app.use(express.static(siteRoot));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
