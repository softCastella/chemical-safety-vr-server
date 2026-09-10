import { Router } from "express";

import { badRequest, serviceUnavailable } from "../../lib/app-error.js";
import { aggregateStarlightEvents } from "./starlight-analytics-aggregation.js";
import { sanitizeStarlightBatch } from "./starlight-analytics-contract.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const maximumBatchBytes = 256 * 1024;

function normalizeOrigin(value) {
  try { return new URL(value).origin; } catch { return null; }
}

function corsMiddleware(allowedOrigins) {
  const allowed = new Set(allowedOrigins.map(normalizeOrigin).filter(Boolean));
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
    response.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (request.method === "OPTIONS") response.status(204).end();
    else next();
  };
}

function createHourlyRateLimiter(maximum, now = Date.now) {
  const clients = new Map();
  return (request, response, next) => {
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const current = now();
    const prior = clients.get(key);
    const state = !prior || prior.resetAt <= current ? { count: 0, resetAt: current + 3600000 } : prior;
    if (state.count >= maximum) {
      response.status(429).json({ error: { code: "STARLIGHT_ANALYTICS_RATE_LIMITED", message: "Too many analytics requests." } });
      return;
    }
    state.count += 1;
    clients.set(key, state);
    next();
  };
}

function readDate(value, fallback, field) {
  const result = value || fallback;
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!datePattern.test(result) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== result) {
    throw badRequest(`${field} must be YYYY-MM-DD.`);
  }
  return result;
}

function optional(value) {
  return !value || value === "all" ? null : String(value).slice(0, 160);
}

export function createStarlightAnalyticsRouter({
  repository,
  ingestEnabled = false,
  allowedOrigins = [],
  rateLimitPerHour = 1200,
  requireAdmin = (_request, _response, next) => next(),
}) {
  const router = Router();
  const cors = corsMiddleware(allowedOrigins);
  const limit = createHourlyRateLimiter(rateLimitPerHour);

  router.options("/events/batch", cors);
  router.post("/events/batch", cors, limit, async (request, response, next) => {
    try {
      if (!ingestEnabled) throw serviceUnavailable("Starlight Analytics ingestion is disabled.");
      if (Buffer.byteLength(JSON.stringify(request.body ?? null), "utf8") > maximumBatchBytes) {
        throw badRequest("Analytics batches must not exceed 256 KiB.");
      }
      const events = sanitizeStarlightBatch(request.body);
      const received = events.length;
      const inserted = await repository.insertEvents(events);
      response.status(202).json({ accepted: inserted, duplicates: Math.max(0, received - inserted) });
    } catch (error) { next(error); }
  });

  if (requireAdmin) router.get("/dashboard", requireAdmin, async (request, response, next) => {
    try {
      const today = new Date();
      const prior = new Date(today);
      prior.setUTCDate(prior.getUTCDate() - 29);
      const dateTo = readDate(request.query.to, today.toISOString().slice(0, 10), "to");
      const dateFrom = readDate(request.query.from, prior.toISOString().slice(0, 10), "from");
      if (dateFrom > dateTo) throw badRequest("from must not be after to.");
      const stageValue = optional(request.query.stage);
      const stageId = stageValue === null ? null : Number(stageValue);
      if (stageId !== null && (!Number.isInteger(stageId) || stageId < 1 || stageId > 5)) throw badRequest("stage must be between 1 and 5.");
      const [events, hasAnyData] = await Promise.all([
        repository.listEvents({
          dateFrom, dateTo, platform: optional(request.query.platform), locale: optional(request.query.locale),
          source: optional(request.query.source), campaign: optional(request.query.campaign), stageId,
        }),
        repository.hasAnyEvents(),
      ]);
      response.set("Cache-Control", "no-store");
      response.json(aggregateStarlightEvents(events, { dateFrom, dateTo, hasAnyData }));
    } catch (error) { next(error); }
  });

  return router;
}
