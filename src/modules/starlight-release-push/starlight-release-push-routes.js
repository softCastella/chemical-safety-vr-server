import { Router } from "express";

import { AppError } from "../../lib/app-error.js";
import { createStarlightReleasePushService } from "./starlight-release-push-service.js";

function createRateLimiter(maximum, now = Date.now) {
  const clients = new Map();
  return (request, _response, next) => {
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const current = now();
    const prior = clients.get(key);
    const state = !prior || prior.resetAt <= current ? { count: 0, resetAt: current + 3600000 } : prior;
    if (state.count >= maximum) {
      next(new AppError(429, "STARLIGHT_RELEASE_PUSH_RATE_LIMITED", "Too many push subscription requests."));
      return;
    }
    state.count += 1;
    clients.set(key, state);
    next();
  };
}

function allowOrigins(allowedOrigins) {
  const allowed = new Set(allowedOrigins.map((value) => {
    try { return new URL(value).origin; } catch { return null; }
  }).filter(Boolean));
  return (request, response, next) => {
    const origin = request.get("origin");
    if (origin && !allowed.has(origin)) {
      response.status(403).json({ error: { code: "ORIGIN_NOT_ALLOWED", message: "The request origin is not allowed." } });
      return;
    }
    if (origin) {
      response.set("Access-Control-Allow-Origin", origin);
      response.set("Vary", "Origin");
    }
    response.set("Access-Control-Allow-Headers", "Content-Type");
    response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (request.method === "OPTIONS") response.status(204).end();
    else next();
  };
}

export function createStarlightReleasePushRouter({
  repository,
  subscribeEnabled = false,
  allowedOrigins = [],
  rateLimitPerHour = 20,
  requireAdmin = null,
}) {
  const router = Router();
  const service = createStarlightReleasePushService({ repository });
  if (subscribeEnabled) {
    const cors = allowOrigins(allowedOrigins);
    router.options("/subscriptions", cors);
    router.post("/subscriptions", cors, createRateLimiter(rateLimitPerHour), async (request, response, next) => {
      try {
        await service.subscribe(request.body);
        response.status(202).json({ data: { accepted: true } });
      } catch (error) { next(error); }
    });
  }
  if (requireAdmin) {
    router.get("/subscriptions", requireAdmin, async (_request, response, next) => {
      try {
        const subscriptions = await service.list();
        response.set("Cache-Control", "no-store");
        response.json({
          data: subscriptions,
          meta: {
            total: subscriptions.length,
            active: subscriptions.filter((item) => item.status === "active").length,
          },
        });
      } catch (error) { next(error); }
    });
  }
  return router;
}
