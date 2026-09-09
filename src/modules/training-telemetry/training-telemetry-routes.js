import { Router } from "express";

import { createTrainingTelemetryService } from "./training-telemetry-service.js";

export function createTrainingTelemetryRouter({
  repository,
  authorizeUpload,
  authorizeRead,
  authenticateMeta,
}) {
  const router = Router();
  const service = createTrainingTelemetryService({ repository });

  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  if (authenticateMeta) {
    router.post("/auth/meta", authenticateMeta);
  }

  router.post("/sessions", authorizeUpload, async (request, response) => {
    const session = await service.createSession(
      request.body,
      request.trainingTelemetryPrincipal,
    );
    response.status(session.created ? 201 : 200).json({ data: session });
  });

  router.post("/sessions/:sessionId/events", authorizeUpload, async (request, response) => {
    const result = await service.saveEvents(
      request.params.sessionId,
      request.body,
      request.trainingTelemetryPrincipal,
    );
    response.status(200).json(result);
  });

  router.post("/sessions/:sessionId/complete", authorizeUpload, async (request, response) => {
    const session = await service.completeSession(
      request.params.sessionId,
      request.body,
      request.trainingTelemetryPrincipal,
    );
    response.status(200).json({ data: session });
  });

  router.get("/sessions", authorizeRead, async (request, response) => {
    const sessions = await service.listSessions(
      request.query.limit,
      request.query.participantId,
    );
    response.status(200).json({ data: sessions });
  });

  router.get("/sessions/:sessionId", authorizeRead, async (request, response) => {
    const session = await service.getSession(request.params.sessionId);
    response.status(200).json({ data: session });
  });

  router.get("/participants", authorizeRead, async (request, response) => {
    const participants = await service.listParticipants(request.query.limit);
    response.status(200).json({ data: participants });
  });

  router.get("/participants/:participantId", authorizeRead, async (request, response) => {
    const participant = await service.getParticipant(request.params.participantId);
    response.status(200).json({ data: participant });
  });

  return router;
}
