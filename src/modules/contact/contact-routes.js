import { Router } from "express";

import { AppError } from "../../lib/app-error.js";
import { createContactService } from "./contact-service.js";

const oneHourMs = 60 * 60 * 1000;

function createRateLimiter({ maximum, now = Date.now }) {
  const clients = new Map();

  return (request, _response, next) => {
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const currentTime = now();
    const state = clients.get(key);

    if (!state || currentTime >= state.resetAt) {
      clients.set(key, { count: 1, resetAt: currentTime + oneHourMs });
      next();
      return;
    }

    if (state.count >= maximum) {
      next(
        new AppError(
          429,
          "CONTACT_RATE_LIMITED",
          "문의 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        ),
      );
      return;
    }

    state.count += 1;
    next();
  };
}

export function createContactRouter({ mailer, rateLimitPerHour = 5 }) {
  const router = Router();
  const service = createContactService({ mailer });

  router.post(
    "/",
    createRateLimiter({ maximum: rateLimitPerHour }),
    async (request, response) => {
      const result = await service.submit(request.body);
      response.status(202).json({
        data: {
          accepted: true,
          id: result.ignored ? null : result.id,
        },
        message: "문의가 접수되었습니다.",
      });
    },
  );

  return router;
}
