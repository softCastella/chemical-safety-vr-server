import { randomUUID } from "node:crypto";

import { badRequest, conflict, notFound } from "../../lib/app-error.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const createFields = new Set([
  "metaUserId",
  "ageGroup",
  "controllerGuideVersionCompleted",
]);
const updateFields = new Set([
  "status",
  "ageGroup",
  "controllerGuideVersionCompleted",
]);

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("The request body must be a JSON object.");
  }
}

function rejectUnknownFields(value, allowedFields) {
  const unknownFields = Object.keys(value).filter(
    (field) => !allowedFields.has(field),
  );

  if (unknownFields.length > 0) {
    throw badRequest("The request contains unsupported fields.", {
      fields: unknownFields,
    });
  }
}

function readMetaUserId(value) {
  if (typeof value !== "string") {
    throw badRequest("metaUserId is required and must be a string.");
  }

  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 128) {
    throw badRequest("metaUserId must contain between 1 and 128 characters.");
  }

  return normalized;
}

function readAgeGroup(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw badRequest("ageGroup must be a string or null.");
  }

  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 32) {
    throw badRequest("ageGroup must contain between 1 and 32 characters.");
  }

  return normalized;
}

function readGuideVersion(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    throw badRequest(
      "controllerGuideVersionCompleted must be an integer between 0 and 65535, or null.",
    );
  }

  return value;
}

function readUserId(value) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw badRequest("The user ID must be a valid UUID.");
  }

  return value.toLowerCase();
}

function readStatus(value) {
  if (value !== "active" && value !== "inactive") {
    throw badRequest("status must be either active or inactive.");
  }

  return value;
}

function readPagination(query) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw badRequest("limit must be an integer between 1 and 100.");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw badRequest("offset must be a non-negative integer.");
  }

  return { limit, offset };
}

function createParticipantCode(id) {
  return `TY-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}

export function createUserService({ repository, idFactory = randomUUID }) {
  return {
    async create(payload) {
      requireObject(payload);
      rejectUnknownFields(payload, createFields);

      const metaUserId = readMetaUserId(payload.metaUserId);
      const existing = await repository.findByMetaUserId(metaUserId);
      if (existing) {
        throw conflict("A user for this Meta identity already exists.");
      }

      const id = idFactory();
      return repository.create({
        id,
        participantCode: createParticipantCode(id),
        metaUserId,
        ageGroup: readAgeGroup(payload.ageGroup),
        controllerGuideVersionCompleted: readGuideVersion(
          payload.controllerGuideVersionCompleted,
        ),
      });
    },

    async get(userId) {
      const normalizedId = readUserId(userId);
      const user = await repository.findById(normalizedId);
      if (!user) {
        throw notFound("User not found.");
      }

      return user;
    },

    async list(query) {
      const pagination = readPagination(query);
      const result = await repository.list(pagination);

      return {
        data: result.users,
        pagination: {
          ...pagination,
          total: result.total,
        },
      };
    },

    async update(userId, payload) {
      const normalizedId = readUserId(userId);
      requireObject(payload);
      rejectUnknownFields(payload, updateFields);

      if (Object.keys(payload).length === 0) {
        throw badRequest("At least one updatable field is required.");
      }

      const changes = {};
      if (Object.hasOwn(payload, "status")) {
        changes.status = readStatus(payload.status);
      }
      if (Object.hasOwn(payload, "ageGroup")) {
        changes.ageGroup = readAgeGroup(payload.ageGroup);
      }
      if (Object.hasOwn(payload, "controllerGuideVersionCompleted")) {
        changes.controllerGuideVersionCompleted = readGuideVersion(
          payload.controllerGuideVersionCompleted,
        );
      }

      const user = await repository.update(normalizedId, changes);
      if (!user) {
        throw notFound("User not found.");
      }

      return user;
    },

    async delete(userId) {
      const normalizedId = readUserId(userId);
      const deleted = await repository.softDelete(normalizedId);
      if (!deleted) {
        throw notFound("User not found.");
      }
    },
  };
}
