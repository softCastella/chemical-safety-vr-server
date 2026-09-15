import { badRequest, notFound } from "../../lib/app-error.js";

const fields = new Set([
  "metaUserId",
  "sessionId",
  "timestampUtc",
  "scene",
  "mode",
  "workPlan",
  "flowState",
]);

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("The request body must be a JSON object.");
  }
}

function readRequiredString(payload, name, maximum = 256) {
  const value = payload[name];
  if (typeof value !== "string") {
    throw badRequest(`${name} is required and must be a string.`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maximum) {
    throw badRequest(`${name} must contain between 1 and ${maximum} characters.`);
  }
  return normalized;
}

function readOptionalString(payload, name, maximum = 256) {
  const value = payload[name];
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw badRequest(`${name} must be a string or null.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw badRequest(`${name} must contain at most ${maximum} characters.`);
  }
  return normalized || null;
}

function readTimestamp(payload) {
  const timestampUtc = readRequiredString(payload, "timestampUtc", 64);
  const parsed = Date.parse(timestampUtc);
  if (Number.isNaN(parsed)) {
    throw badRequest("timestampUtc must be an ISO-8601 date-time string.");
  }
  return new Date(parsed).toISOString();
}

function normalizeSessionId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(value)) {
    throw badRequest("sessionId must contain only letters, numbers, or hyphens.");
  }
  return value;
}

export function createTrainingRegistrationService({ repository, now = () => new Date() }) {
  return {
    async register(payload) {
      requireObject(payload);
      const unknownFields = Object.keys(payload).filter((field) => !fields.has(field));
      if (unknownFields.length > 0) {
        throw badRequest("The request contains unsupported fields.", { fields: unknownFields });
      }

      const record = {
        metaUserId: readRequiredString(payload, "metaUserId", 128),
        sessionId: normalizeSessionId(readRequiredString(payload, "sessionId", 128)),
        timestampUtc: readTimestamp(payload),
        scene: readRequiredString(payload, "scene", 512),
        mode: readOptionalString(payload, "mode", 64),
        workPlan: readOptionalString(payload, "workPlan", 64),
        flowState: readOptionalString(payload, "flowState", 128),
        serverReceivedAt: now().toISOString(),
      };

      return repository.save(record);
    },

    async get(sessionId) {
      const normalizedSessionId = normalizeSessionId(sessionId);
      const record = await repository.findBySessionId(normalizedSessionId);
      if (!record) {
        throw notFound("Training registration not found.");
      }
      return record;
    },
  };
}
