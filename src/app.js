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
import { createServerAdminCountryLookup } from "./modules/server-admin/server-admin-country-lookup.js";
import { createServerAdminPushService } from "./modules/server-admin/server-admin-push.js";
import { createTrainingTelemetryAuthorizers } from "./modules/training-telemetry/training-telemetry-auth.js";
import {
  createMetaUserProofVerifier,
  createTrainingTelemetryMetaAuthenticator,
  createTrainingTelemetrySessionTokenService,
} from "./modules/training-telemetry/training-telemetry-meta-auth.js";
import { createTrainingTelemetryRepository } from "./modules/training-telemetry/training-telemetry-repository.js";
import { createTrainingTelemetryRouter } from "./modules/training-telemetry/training-telemetry-routes.js";
import { createContactRouter } from "./modules/contact/contact-routes.js";
import { createResendContactMailer } from "./modules/contact/resend-contact-mailer.js";
import { createStarlightAnalyticsRepository } from "./modules/starlight-analytics/starlight-analytics-repository.js";
import { createStarlightAnalyticsRouter } from "./modules/starlight-analytics/starlight-analytics-routes.js";
import { createStarlightReleasePushRepository } from "./modules/starlight-release-push/starlight-release-push-repository.js";
import { createStarlightReleasePushRouter } from "./modules/starlight-release-push/starlight-release-push-routes.js";

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
const starlightAnalyticsRoot = path.join(publicRoot, "starlight-analytics");
const serverDashboardPath = "/server";
const starlightDashboardPath = "/starlight-sudoku";
const chemicalSafetyVrDashboardPath = "/chemical-safety-training-vr";

const redirectToTrailingSlash = (target) => (request, response, next) => {
  if (request.path.endsWith("/")) return next();
  return response.redirect(308, `${target}/`);
};

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
  enableMetaTrainingTelemetryAuth = env.enableMetaTrainingTelemetryAuth,
  metaPlatformAppAccessToken = env.metaPlatformAppAccessToken,
  trainingTelemetrySessionTokenSecret = env.trainingTelemetrySessionTokenSecret,
  trainingTelemetrySessionTokenTtlSeconds = env.trainingTelemetrySessionTokenTtlSeconds,
  trainingTelemetryMetaProofVerifier,
  trainingTelemetryTokenClock,
  serverAdminRepository,
  serverAdminCountryLookupService,
  serverAdminPushService,
  enableServerAdmin = env.enableServerAdmin,
  contactMailer,
  enableContactForm = env.enableContactForm,
  contactRateLimitPerHour = env.contact.rateLimitPerHour,
  starlightAnalyticsRepository,
  enableStarlightAnalyticsIngest = env.enableStarlightAnalyticsIngest,
  starlightAnalyticsAllowedOrigins = env.starlightAnalyticsAllowedOrigins,
  starlightAnalyticsRateLimitPerHour = env.starlightAnalyticsRateLimitPerHour,
  starlightReleasePushRepository,
  enableStarlightReleasePush = env.enableStarlightReleasePush,
  starlightReleasePushRateLimitPerHour = env.starlightReleasePush.rateLimitPerHour,
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

  const starlightAnalyticsEnabled = enableStarlightAnalyticsIngest || enableServerAdmin;
  const resolvedStarlightAnalyticsRepository = starlightAnalyticsEnabled
    ? starlightAnalyticsRepository ?? createStarlightAnalyticsRepository(databasePool)
    : null;
  if (enableStarlightAnalyticsIngest) {
    app.use(
      "/api/starlight-analytics",
      createStarlightAnalyticsRouter({
        repository: resolvedStarlightAnalyticsRepository,
        ingestEnabled: true,
        allowedOrigins: starlightAnalyticsAllowedOrigins,
        rateLimitPerHour: starlightAnalyticsRateLimitPerHour,
        requireAdmin: null,
      }),
    );
  }

  const starlightReleasePushEnabled = enableStarlightReleasePush || enableServerAdmin;
  const resolvedStarlightReleasePushRepository = starlightReleasePushEnabled
    ? starlightReleasePushRepository ?? createStarlightReleasePushRepository(databasePool)
    : null;
  if (enableStarlightReleasePush) {
    app.use(
      "/api/starlight-release-push",
      createStarlightReleasePushRouter({
        repository: resolvedStarlightReleasePushRepository,
        subscribeEnabled: true,
        allowedOrigins: starlightAnalyticsAllowedOrigins,
        rateLimitPerHour: starlightReleasePushRateLimitPerHour,
      }),
    );
  }

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

  const resolvedTrainingTelemetryRepository = enableTrainingTelemetryIngest
    ? trainingTelemetryRepository ?? createTrainingTelemetryRepository(databasePool)
    : null;
  if (enableTrainingTelemetryIngest) {
    const sessionTokenService = enableMetaTrainingTelemetryAuth
      ? createTrainingTelemetrySessionTokenService({
          secret: trainingTelemetrySessionTokenSecret,
          lifetimeSeconds: trainingTelemetrySessionTokenTtlSeconds,
          now: trainingTelemetryTokenClock,
        })
      : null;
    const { authorizeUpload, authorizeRead } = createTrainingTelemetryAuthorizers({
      developmentToken: trainingTelemetryUploadToken,
      sessionTokenService,
    });
    const authenticateMeta = enableMetaTrainingTelemetryAuth
      ? createTrainingTelemetryMetaAuthenticator({
          verifyUserProof: trainingTelemetryMetaProofVerifier ??
            createMetaUserProofVerifier({ appAccessToken: metaPlatformAppAccessToken }),
          sessionTokenService,
        })
      : null;
    app.use(
      "/api/training-telemetry",
      createTrainingTelemetryRouter({
        repository: resolvedTrainingTelemetryRepository,
        authorizeUpload,
        authorizeRead,
        authenticateMeta,
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
    const resolvedCountryLookupService = serverAdminCountryLookupService
      ?? createServerAdminCountryLookup(env.serverAdminCountryLookup);
    const resolvedPushService = serverAdminPushService ?? createServerAdminPushService(env.serverAdminPush);
    const { router, requireAdmin, requireAdminPage } = createServerAdminRouter({
      repository: resolvedAdminRepository,
      countryLookupService: resolvedCountryLookupService,
      pushService: resolvedPushService,
    });
    app.use("/api/server-status", router);
    app.get("/api/training-telemetry/dashboard-overview", requireAdmin, async (request, response) => {
      response.set("Cache-Control", "no-store");
      if (!resolvedTrainingTelemetryRepository) {
        response.status(503).json({ error: "ENABLE_TRAINING_TELEMETRY_INGEST is not enabled." });
        return;
      }
      const days = request.query.days === undefined ? 30 : Number(request.query.days);
      if (![7, 30].includes(days)) {
        response.status(400).json({ error: "days must be 7 or 30." });
        return;
      }
      response.json({ data: await resolvedTrainingTelemetryRepository.getDashboardOverview(days) });
    });
    app.use(
      "/api/starlight-analytics",
      createStarlightAnalyticsRouter({
        repository: resolvedStarlightAnalyticsRepository,
        ingestEnabled: false,
        allowedOrigins: starlightAnalyticsAllowedOrigins,
        rateLimitPerHour: starlightAnalyticsRateLimitPerHour,
        requireAdmin,
      }),
    );
    app.use(
      "/api/starlight-release-push",
      createStarlightReleasePushRouter({
        repository: resolvedStarlightReleasePushRepository,
        requireAdmin,
      }),
    );
    app.get(`${serverDashboardPath}/login`, (_request, response) => response.sendFile(path.join(serverStatusRoot, "login.html")));
    app.get(`${serverDashboardPath}/login.html`, (_request, response) => response.redirect(308, `${serverDashboardPath}/login`));
    for (const asset of [
      "status.css",
      "controls.css",
      "login.css",
      "login.js",
      "dashboard.js",
      "dashboard-switcher.css",
      "dashboard-switcher.js",
      "push-worker.js",
      "manifest.webmanifest",
    ]) {
      app.get(`${serverDashboardPath}/${asset}`, (_request, response) => response.sendFile(path.join(serverStatusRoot, asset)));
    }
    app.get(`${serverDashboardPath}/favicon.svg`, (_request, response) => response.sendFile(path.join(siteRoot, "assets", "Immersa", "Chemical Safety Training VR", "favicon_round_crop.svg")));
    app.get(serverDashboardPath, redirectToTrailingSlash(serverDashboardPath));
    app.get(`${serverDashboardPath}/`, requireAdminPage(`${serverDashboardPath}/`), (_request, response) => response.sendFile(path.join(serverStatusRoot, "index.html")));
    app.get(starlightDashboardPath, redirectToTrailingSlash(starlightDashboardPath));
    app.get(`${starlightDashboardPath}/`, requireAdminPage(`${starlightDashboardPath}/`), (_request, response) => response.sendFile(path.join(starlightAnalyticsRoot, "index.html")));
    app.use(starlightDashboardPath, requireAdmin, express.static(starlightAnalyticsRoot, { index: false }));
    app.get(chemicalSafetyVrDashboardPath, redirectToTrailingSlash(chemicalSafetyVrDashboardPath));
    app.get(`${chemicalSafetyVrDashboardPath}/`, requireAdminPage(`${chemicalSafetyVrDashboardPath}/`), (_request, response) => response.sendFile(path.join(dashboardRoot, "index.html")));
    app.use(chemicalSafetyVrDashboardPath, requireAdmin, express.static(dashboardRoot, { index: false }));

    app.get(["/server-status/login", "/server-status/login.html"], (_request, response) => response.redirect(308, `${serverDashboardPath}/login`));
    app.get(["/server-status", "/server-status/"], (_request, response) => response.redirect(308, `${serverDashboardPath}/`));
    app.get(["/starlight-analytics", "/starlight-analytics/"], (_request, response) => response.redirect(308, `${starlightDashboardPath}/`));
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
