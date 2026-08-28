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

    next();
  };
}
