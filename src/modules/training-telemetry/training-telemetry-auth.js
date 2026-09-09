import { timingSafeEqual } from "node:crypto";

import { unauthorized } from "../../lib/app-error.js";

function tokensMatch(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}

export function createTrainingTelemetryTokenAuthorizer(expectedToken) {
  if (
    typeof expectedToken !== "string" ||
    expectedToken.length < 16 ||
    expectedToken.length > 512 ||
    !/^[\x21-\x7e]+$/.test(expectedToken)
  ) {
    throw new Error(
      "TRAINING_TELEMETRY_UPLOAD_TOKEN must contain 16 to 512 non-whitespace ASCII characters when ENABLE_TRAINING_TELEMETRY_INGEST=true.",
    );
  }

  return function authorizeTrainingTelemetry(request, _response, next) {
    const authorization = request.get("authorization") ?? "";
    const prefix = "Bearer ";
    const token = authorization.startsWith(prefix)
      ? authorization.slice(prefix.length)
      : "";

    if (!tokensMatch(token, expectedToken)) {
      next(unauthorized("A valid training telemetry upload token is required."));
      return;
    }

    request.trainingTelemetryPrincipal = Object.freeze({ kind: "development" });
    next();
  };
}

export function createTrainingTelemetryAuthorizers({
  developmentToken,
  sessionTokenService,
}) {
  const hasDevelopmentToken = typeof developmentToken === "string" &&
    developmentToken.length > 0;
  const authorizeDevelopment = hasDevelopmentToken
    ? createTrainingTelemetryTokenAuthorizer(developmentToken)
    : null;

  if (!authorizeDevelopment && !sessionTokenService) {
    throw new Error(
      "TRAINING_TELEMETRY_UPLOAD_TOKEN or Meta training telemetry authentication must be configured when ENABLE_TRAINING_TELEMETRY_INGEST=true.",
    );
  }

  function bearerToken(request) {
    const authorization = request.get("authorization") ?? "";
    return authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : "";
  }

  return Object.freeze({
    authorizeUpload(request, response, next) {
      const token = bearerToken(request);
      if (authorizeDevelopment && tokensMatch(token, developmentToken)) {
        request.trainingTelemetryPrincipal = Object.freeze({ kind: "development" });
        next();
        return;
      }
      if (sessionTokenService) {
        try {
          request.trainingTelemetryPrincipal = sessionTokenService.verify(token);
          next();
        } catch (error) {
          next(error);
        }
        return;
      }
      authorizeDevelopment(request, response, next);
    },

    authorizeRead(request, response, next) {
      if (!authorizeDevelopment) {
        next(unauthorized("A development telemetry read token is required."));
        return;
      }
      authorizeDevelopment(request, response, next);
    },
  });
}
