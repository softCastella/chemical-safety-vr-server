import { createHmac, timingSafeEqual } from "node:crypto";

import {
  badRequest,
  serviceUnavailable,
  unauthorized,
} from "../../lib/app-error.js";

const metaUserIdPattern = /^[0-9]{1,64}$/;
const userProofPattern = /^[\x21-\x7e]{16,2048}$/;
const tokenType = "training-telemetry-upload";
const defaultVerifyUrl = "https://graph.oculus.com/user_nonce_validate";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function signatureFor(encodedPayload, secret) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function constantTimeEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}

function requireSessionTokenSecret(secret) {
  if (
    typeof secret !== "string" ||
    secret.length < 32 ||
    secret.length > 512 ||
    !/^[\x21-\x7e]+$/.test(secret)
  ) {
    throw new Error(
      "TRAINING_TELEMETRY_SESSION_TOKEN_SECRET must contain 32 to 512 non-whitespace ASCII characters when ENABLE_META_TRAINING_TELEMETRY_AUTH=true.",
    );
  }
}

function requireTokenLifetime(value) {
  if (!Number.isInteger(value) || value < 60 || value > 3600) {
    throw new Error(
      "TRAINING_TELEMETRY_SESSION_TOKEN_TTL_SECONDS must be an integer between 60 and 3600.",
    );
  }
}

function readMetaUserId(value) {
  if (typeof value !== "string" || !metaUserIdPattern.test(value)) {
    throw badRequest("metaUserId must contain between 1 and 64 decimal digits.");
  }
  return value;
}

function readUserProof(value) {
  if (typeof value !== "string" || !userProofPattern.test(value)) {
    throw badRequest(
      "userProof must contain between 16 and 2048 non-whitespace ASCII characters.",
    );
  }
  return value;
}

export function createTrainingTelemetrySessionTokenService({
  secret,
  lifetimeSeconds = 900,
  now = () => Date.now(),
}) {
  requireSessionTokenSecret(secret);
  requireTokenLifetime(lifetimeSeconds);

  return Object.freeze({
    lifetimeSeconds,

    issue(metaUserIdValue) {
      const metaUserId = readMetaUserId(metaUserIdValue);
      const issuedAt = Math.floor(now() / 1000);
      const payload = {
        version: 1,
        type: tokenType,
        subject: metaUserId,
        issuedAt,
        expiresAt: issuedAt + lifetimeSeconds,
      };
      const encodedPayload = base64Url(JSON.stringify(payload));
      return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
    },

    verify(token) {
      if (typeof token !== "string" || token.length < 1 || token.length > 2048) {
        throw unauthorized("A valid training telemetry upload token is required.");
      }
      const parts = token.split(".");
      if (parts.length !== 2) {
        throw unauthorized("A valid training telemetry upload token is required.");
      }
      const [encodedPayload, actualSignature] = parts;
      const expectedSignature = signatureFor(encodedPayload, secret);
      if (!constantTimeEqual(actualSignature, expectedSignature)) {
        throw unauthorized("A valid training telemetry upload token is required.");
      }

      let payload;
      try {
        payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
      } catch {
        throw unauthorized("A valid training telemetry upload token is required.");
      }
      const currentTime = Math.floor(now() / 1000);
      if (
        payload?.version !== 1 ||
        payload?.type !== tokenType ||
        typeof payload.subject !== "string" ||
        !metaUserIdPattern.test(payload.subject) ||
        !Number.isInteger(payload.issuedAt) ||
        !Number.isInteger(payload.expiresAt) ||
        payload.expiresAt <= currentTime ||
        payload.issuedAt > currentTime + 30 ||
        payload.expiresAt - payload.issuedAt !== lifetimeSeconds
      ) {
        throw unauthorized("The training telemetry upload token is invalid or expired.");
      }
      return Object.freeze({ kind: "meta", metaUserId: payload.subject });
    },
  });
}

export function createMetaUserProofVerifier({
  appAccessToken,
  fetchImplementation = globalThis.fetch,
  verifyUrl = defaultVerifyUrl,
  timeoutMilliseconds = 5000,
}) {
  if (
    typeof appAccessToken !== "string" ||
    appAccessToken.length < 16 ||
    appAccessToken.length > 2048 ||
    !/^[\x21-\x7e]+$/.test(appAccessToken)
  ) {
    throw new Error(
      "META_PLATFORM_APP_ACCESS_TOKEN must contain 16 to 2048 non-whitespace ASCII characters when ENABLE_META_TRAINING_TELEMETRY_AUTH=true.",
    );
  }
  if (typeof fetchImplementation !== "function") {
    throw new Error("A fetch implementation is required for Meta User Proof verification.");
  }

  return async function verifyMetaUserProof({ metaUserId, userProof }) {
    const url = new URL(verifyUrl);
    const body = new URLSearchParams({
      access_token: appAccessToken,
      nonce: userProof,
      user_id: metaUserId,
    });

    let response;
    try {
      response = await fetchImplementation(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch {
      throw serviceUnavailable("Meta User Proof verification is temporarily unavailable.");
    }

    let responseBody;
    try {
      responseBody = await response.json();
    } catch {
      throw serviceUnavailable("Meta User Proof verification returned an invalid response.");
    }
    if (!response.ok) {
      if (response.status >= 500) {
        throw serviceUnavailable("Meta User Proof verification is temporarily unavailable.");
      }
      return false;
    }
    return responseBody?.is_valid === true;
  };
}

export function createTrainingTelemetryMetaAuthenticator({
  verifyUserProof,
  sessionTokenService,
}) {
  if (typeof verifyUserProof !== "function") {
    throw new Error("A Meta User Proof verifier is required.");
  }

  return async function authenticateMetaUser(request, response) {
    const payload = request.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw badRequest("request body must be a JSON object.");
    }
    const unknownFields = Object.keys(payload).filter(
      (field) => field !== "metaUserId" && field !== "userProof",
    );
    if (unknownFields.length > 0) {
      throw badRequest("request body contains unsupported fields.", { unknownFields });
    }

    const metaUserId = readMetaUserId(payload.metaUserId);
    const userProof = readUserProof(payload.userProof);
    if (!await verifyUserProof({ metaUserId, userProof })) {
      throw unauthorized("Meta User Proof verification failed.");
    }

    response.status(200).json({
      data: {
        accessToken: sessionTokenService.issue(metaUserId),
        tokenType: "Bearer",
        expiresIn: sessionTokenService.lifetimeSeconds,
        metaUserId,
      },
    });
  };
}
