import { badRequest, conflict, notFound } from "../../lib/app-error.js";

const supportedSchemaVersion = 1;
const sessionIdPattern = /^[A-Za-z0-9-]{1,128}$/;
const eventIdPattern = /^[A-Za-z0-9:._-]{1,256}$/;
const eventTypePattern = /^[a-z][a-z0-9_]{0,127}$/;

const sessionFields = new Set([
  "schemaVersion",
  "sourceProject",
  "clientInstanceId",
  "metaUserId",
  "sessionId",
  "startedAtUtc",
  "appVersion",
  "scene",
  "mode",
  "workPlan",
]);

const eventFields = new Set([
  "schemaVersion",
  "sessionId",
  "eventId",
  "sequence",
  "timestampUtc",
  "eventType",
  "appVersion",
  "scene",
  "mode",
  "workPlan",
  "modeSessionId",
  "flowState",
  "itemType",
  "itemName",
  "condition",
  "choice",
  "result",
  "note",
  "metaProbeState",
  "metaWelcomeState",
  "requiredPpeCheck",
  "missingRequiredPpe",
  "audioClip",
  "audioLengthSec",
  "audioElapsedSec",
  "attemptId",
  "hand",
  "inputControl",
  "hoveredPpeCount",
  "hoveredPpeItems",
  "attemptOutcome",
  "attemptElapsedSec",
  "quizTopic",
  "quizQuestionIndex",
  "quizQuestionCount",
  "quizSelectedOptionIndex",
  "quizCorrect",
  "quizCorrectCount",
  "ppeWrongCount",
  "modeElapsedSec",
]);

const optionalStringLimits = Object.freeze({
  appVersion: 64,
  scene: 512,
  mode: 64,
  workPlan: 128,
  modeSessionId: 64,
  flowState: 128,
  itemType: 128,
  itemName: 256,
  condition: 128,
  choice: 128,
  result: 128,
  note: 2048,
  metaProbeState: 64,
  metaWelcomeState: 64,
  requiredPpeCheck: 1024,
  missingRequiredPpe: 1024,
  audioClip: 256,
  attemptId: 128,
  hand: 32,
  inputControl: 256,
  hoveredPpeItems: 1024,
  attemptOutcome: 128,
  quizTopic: 64,
});

const measuredModes = new Set(["Education", "Training", "Test"]);
const modeSessionIdPattern = /^[a-f0-9]{32}$/;

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`${name} must be a JSON object.`);
  }
}

function rejectUnknownFields(value, allowedFields, name) {
  const unknownFields = Object.keys(value).filter(
    (field) => !allowedFields.has(field),
  );

  if (unknownFields.length > 0) {
    throw badRequest(`${name} contains unsupported fields.`, { unknownFields });
  }
}

function readSchemaVersion(value) {
  if (value !== supportedSchemaVersion) {
    throw badRequest(
      `schemaVersion must be ${supportedSchemaVersion}.`,
    );
  }
  return value;
}

function readRequiredString(value, name, maximumLength, pattern) {
  if (typeof value !== "string" || value.length < 1 || value.length > maximumLength) {
    throw badRequest(`${name} must be a string between 1 and ${maximumLength} characters.`);
  }
  if (pattern && !pattern.test(value)) {
    throw badRequest(`${name} contains unsupported characters.`);
  }
  return value;
}

function readOptionalString(value, name, maximumLength) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || value.length > maximumLength) {
    throw badRequest(`${name} must be a string up to ${maximumLength} characters.`);
  }
  return value;
}

function readTimestamp(value, name) {
  if (typeof value !== "string" || !value.endsWith("Z")) {
    throw badRequest(`${name} must be an ISO 8601 UTC timestamp ending in Z.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw badRequest(`${name} must be a valid timestamp.`);
  }
  return date.toISOString();
}

function readPositiveInteger(value, name, maximum) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw badRequest(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function readNonNegativeNumber(value, name, maximum) {
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw badRequest(`${name} must be a number between 0 and ${maximum}.`);
  }
  return value;
}

function readNonNegativeInteger(value, name, maximum) {
  const normalized = readNonNegativeNumber(value, name, maximum);
  if (!Number.isInteger(normalized)) {
    throw badRequest(`${name} must be an integer.`);
  }
  return normalized;
}

function readOptionalBoolean(value, name) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value !== "boolean") {
    throw badRequest(`${name} must be a boolean.`);
  }
  return value;
}

function validateModeMeasurement(event, name) {
  if (!["mode_session_started", "quiz_answer_resolved", "mode_session_completed"]
    .includes(event.eventType)) {
    return;
  }
  if (!event.modeSessionId || !modeSessionIdPattern.test(event.modeSessionId)) {
    throw badRequest(`${name}.modeSessionId must be a 32-character lowercase hexadecimal ID.`);
  }
  if (!measuredModes.has(event.mode)) {
    throw badRequest(`${name}.mode must be Education, Training, or Test for mode measurement events.`);
  }

  if (event.eventType === "quiz_answer_resolved") {
    if (!event.quizTopic) {
      throw badRequest(`${name}.quizTopic is required for quiz_answer_resolved.`);
    }
    if (event.quizQuestionCount < 1 ||
        event.quizQuestionIndex < 1 ||
        event.quizQuestionIndex > event.quizQuestionCount ||
        event.quizSelectedOptionIndex < 1) {
      throw badRequest(`${name} contains invalid quiz answer indexes.`);
    }
  }

  if (event.eventType === "mode_session_completed" &&
      (event.quizQuestionCount < 1 ||
       event.quizCorrectCount > event.quizQuestionCount)) {
    throw badRequest(`${name} contains invalid mode completion counts.`);
  }
}

function rejectLocalPath(note) {
  if (note && (/[A-Za-z]:[\\/]/.test(note) || /\/(?:Users|home)\//.test(note))) {
    throw badRequest("note must not contain a local filesystem path.");
  }
}

function normalizeEvent(event, expectedSessionId, index) {
  const name = `events[${index}]`;
  requireObject(event, name);
  rejectUnknownFields(event, eventFields, name);

  const sessionId = readRequiredString(
    event.sessionId,
    `${name}.sessionId`,
    128,
    sessionIdPattern,
  );
  if (sessionId !== expectedSessionId) {
    throw badRequest(`${name}.sessionId must match the URL sessionId.`);
  }

  const normalized = {
    schemaVersion: readSchemaVersion(event.schemaVersion),
    sessionId,
    eventId: readRequiredString(
      event.eventId,
      `${name}.eventId`,
      256,
      eventIdPattern,
    ),
    sequence: readPositiveInteger(event.sequence, `${name}.sequence`, 10_000_000),
    timestampUtc: readTimestamp(event.timestampUtc, `${name}.timestampUtc`),
    eventType: readRequiredString(
      event.eventType,
      `${name}.eventType`,
      128,
      eventTypePattern,
    ),
  };

  for (const [field, maximumLength] of Object.entries(optionalStringLimits)) {
    normalized[field] = readOptionalString(
      event[field],
      `${name}.${field}`,
      maximumLength,
    );
  }

  normalized.audioLengthSec = readNonNegativeNumber(
    event.audioLengthSec,
    `${name}.audioLengthSec`,
    86_400,
  );
  normalized.audioElapsedSec = readNonNegativeNumber(
    event.audioElapsedSec,
    `${name}.audioElapsedSec`,
    86_400,
  );
  normalized.hoveredPpeCount = readNonNegativeNumber(
    event.hoveredPpeCount,
    `${name}.hoveredPpeCount`,
    10_000,
  );
  normalized.attemptElapsedSec = readNonNegativeNumber(
    event.attemptElapsedSec,
    `${name}.attemptElapsedSec`,
    86_400,
  );
  normalized.quizQuestionIndex = readNonNegativeInteger(
    event.quizQuestionIndex,
    `${name}.quizQuestionIndex`,
    10_000,
  );
  normalized.quizQuestionCount = readNonNegativeInteger(
    event.quizQuestionCount,
    `${name}.quizQuestionCount`,
    10_000,
  );
  normalized.quizSelectedOptionIndex = readNonNegativeInteger(
    event.quizSelectedOptionIndex,
    `${name}.quizSelectedOptionIndex`,
    10_000,
  );
  normalized.quizCorrect = readOptionalBoolean(
    event.quizCorrect,
    `${name}.quizCorrect`,
  );
  normalized.quizCorrectCount = readNonNegativeInteger(
    event.quizCorrectCount,
    `${name}.quizCorrectCount`,
    10_000,
  );
  normalized.ppeWrongCount = readNonNegativeInteger(
    event.ppeWrongCount,
    `${name}.ppeWrongCount`,
    10_000,
  );
  normalized.modeElapsedSec = readNonNegativeNumber(
    event.modeElapsedSec,
    `${name}.modeElapsedSec`,
    86_400,
  );

  rejectLocalPath(normalized.note);
  validateModeMeasurement(normalized, name);
  return normalized;
}

export function createTrainingTelemetryService({ repository }) {
  return {
    async createSession(payload) {
      requireObject(payload, "request body");
      rejectUnknownFields(payload, sessionFields, "request body");

      return repository.createSession({
        schemaVersion: readSchemaVersion(payload.schemaVersion),
        sourceProject: (() => {
          const sourceProject = readRequiredString(
            payload.sourceProject,
            "sourceProject",
            64,
            /^[a-z0-9-]+$/,
          );
          if (sourceProject !== "chemical-safety-vr-client") {
            throw badRequest(
              "sourceProject must be chemical-safety-vr-client.",
            );
          }
          return sourceProject;
        })(),
        clientInstanceId: readRequiredString(
          payload.clientInstanceId,
          "clientInstanceId",
          32,
          /^[a-f0-9]{32}$/,
        ),
        metaUserId: (() => {
          const metaUserId = readOptionalString(
            payload.metaUserId,
            "metaUserId",
            64,
          );
          if (metaUserId !== null && !/^[0-9]+$/.test(metaUserId)) {
            throw badRequest("metaUserId must contain only decimal digits.");
          }
          return metaUserId;
        })(),
        sessionId: readRequiredString(
          payload.sessionId,
          "sessionId",
          128,
          sessionIdPattern,
        ),
        startedAtUtc: readTimestamp(payload.startedAtUtc, "startedAtUtc"),
        appVersion: readOptionalString(payload.appVersion, "appVersion", 64),
        scene: readOptionalString(payload.scene, "scene", 512),
        mode: readOptionalString(payload.mode, "mode", 64),
        workPlan: readOptionalString(payload.workPlan, "workPlan", 128),
      });
    },

    async saveEvents(sessionIdValue, payload) {
      const sessionId = readRequiredString(
        sessionIdValue,
        "sessionId",
        128,
        sessionIdPattern,
      );
      requireObject(payload, "request body");
      rejectUnknownFields(payload, new Set(["events"]), "request body");

      if (!Array.isArray(payload.events) || payload.events.length < 1 || payload.events.length > 50) {
        throw badRequest("events must contain between 1 and 50 items.");
      }

      const events = payload.events.map((event, index) =>
        normalizeEvent(event, sessionId, index));
      const eventIds = new Set(events.map((event) => event.eventId));
      const sequences = new Set(events.map((event) => event.sequence));
      if (eventIds.size !== events.length || sequences.size !== events.length) {
        throw conflict("A batch must not contain duplicate eventId or sequence values.");
      }

      return repository.saveEvents(sessionId, events);
    },

    async completeSession(sessionIdValue, payload) {
      const sessionId = readRequiredString(
        sessionIdValue,
        "sessionId",
        128,
        sessionIdPattern,
      );
      requireObject(payload, "request body");
      rejectUnknownFields(
        payload,
        new Set(["schemaVersion", "endedAtUtc", "reason"]),
        "request body",
      );

      return repository.completeSession(sessionId, {
        schemaVersion: readSchemaVersion(payload.schemaVersion),
        endedAtUtc: readTimestamp(payload.endedAtUtc, "endedAtUtc"),
        reason: readRequiredString(payload.reason, "reason", 128),
      });
    },

    async listSessions(limitValue, participantIdValue) {
      const limit = limitValue === undefined
        ? 25
        : readPositiveInteger(Number(limitValue), "limit", 100);
      const participantId = participantIdValue === undefined
        ? null
        : readPositiveInteger(
            Number(participantIdValue),
            "participantId",
            Number.MAX_SAFE_INTEGER,
          );
      return repository.listSessions({ limit, participantId });
    },

    async getSession(sessionIdValue) {
      const sessionId = readRequiredString(
        sessionIdValue,
        "sessionId",
        128,
        sessionIdPattern,
      );
      const session = await repository.findSession(sessionId);
      if (!session) {
        throw notFound("Training telemetry session not found.");
      }
      return session;
    },

    async listParticipants(limitValue) {
      const limit = limitValue === undefined
        ? 50
        : readPositiveInteger(Number(limitValue), "limit", 100);
      return repository.listParticipants(limit);
    },

    async getParticipant(participantIdValue) {
      const participantId = readPositiveInteger(
        Number(participantIdValue),
        "participantId",
        Number.MAX_SAFE_INTEGER,
      );
      const participant = await repository.findParticipant(participantId);
      if (!participant) {
        throw notFound("Training telemetry participant not found.");
      }
      return participant;
    },
  };
}
