import { Router } from "express";

import { createTrainingRegistrationService } from "./training-registration-service.js";

export function createTrainingRegistrationRouter({ repository }) {
  const router = Router();
  const service = createTrainingRegistrationService({ repository });

  router.post("/", async (request, response) => {
    const record = await service.register(request.body);
    response
      .location(`/api/training-registrations/${record.sessionId}`)
      .status(201)
      .json({ message: "가입이 완료되었습니다.", data: record });
  });

  router.get("/:sessionId", async (request, response) => {
    const record = await service.get(request.params.sessionId);
    response.status(200).json({ data: record });
  });

  return router;
}
