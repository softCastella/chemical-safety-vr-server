import { Router } from "express";

import { createTrainingTelemetryService } from "./training-telemetry-service.js";

export function createTrainingTelemetryRouter({ repository, authorize }) {
  const router = Router();
  const service = createTrainingTelemetryService({ repository });

  router.use(authorize);
  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  router.post("/sessions", async (request, response) => {
    const session = await service.createSession(request.body);
    response.status(session.created ? 201 : 200).json({ data: session });
  });

  router.post("/sessions/:sessionId/events", async (request, response) => {
    const result = await service.saveEvents(request.params.sessionId, request.body);
    response.status(200).json(result);
  });

  router.post("/sessions/:sessionId/complete", async (request, response) => {
    const session = await service.completeSession(
      request.params.sessionId,
      request.body,
    );
    response.status(200).json({ data: session });
  });

  router.get("/sessions", async (request, response) => {
    const sessions = await service.listSessions(
      request.query.limit,
      request.query.participantId,
    );
    response.status(200).json({ data: sessions });
  });

  router.get("/sessions/:sessionId", async (request, response) => {
    const session = await service.getSession(request.params.sessionId);
    response.status(200).json({ data: session });
  });

  router.get("/participants", async (request, response) => {
    const participants = await service.listParticipants(request.query.limit);
    response.status(200).json({ data: participants });
  });

  router.get("/participants/:participantId", async (request, response) => {
    const participant = await service.getParticipant(request.params.participantId);
    response.status(200).json({ data: participant });
  });

  return router;
}
