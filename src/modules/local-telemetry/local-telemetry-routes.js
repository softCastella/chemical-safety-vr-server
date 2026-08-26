import { Router } from "express";

import { badRequest, notFound } from "../../lib/app-error.js";

const sessionIdPattern = /^[A-Za-z0-9-]{1,128}$/;

export function createLocalTelemetryRouter({ repository }) {
  const router = Router();

  router.get("/sessions", async (_request, response) => {
    const sessions = await repository.list();
    response.status(200).json({ data: sessions });
  });

  router.get("/sessions/:sessionId", async (request, response) => {
    const { sessionId } = request.params;
    if (!sessionIdPattern.test(sessionId)) {
      throw badRequest("sessionId must contain only letters, numbers, or hyphens.");
    }
    const session = await repository.findBySessionId(sessionId);
    if (!session) {
      throw notFound("Telemetry session not found.");
    }
    response.status(200).json({ data: session });
  });

  return router;
}
