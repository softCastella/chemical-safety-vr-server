import { badRequest } from "../../lib/app-error.js";

const allowedFields = new Set([
  "installationId",
  "consent",
  "locale",
  "source",
  "medium",
  "campaign",
  "website",
]);

export const starlightReleasePushConsentVersion = "2026-09-11";

function requireObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw badRequest(message);
}

function readText(value, name, maximum) {
  if (typeof value !== "string") throw badRequest(`${name} must be a string.`);
  const result = value.trim();
  if (!result || result.length > maximum) throw badRequest(`${name} is invalid.`);
  return result;
}

function optionalText(value, name, fallback, maximum) {
  if (value === undefined || value === null || value === "") return fallback;
  return readText(value, name, maximum);
}

function sanitizeSubscription(payload, now) {
  requireObject(payload, "The request body must be a JSON object.");
  const unknown = Object.keys(payload).filter((field) => !allowedFields.has(field));
  if (unknown.length) throw badRequest("Unsupported fields were provided.", { fields: unknown });
  if (payload.consent !== true) throw badRequest("Notification consent is required.");
  return {
    installationId: readText(payload.installationId, "installationId", 512),
    locale: optionalText(payload.locale, "locale", "ko", 16),
    source: optionalText(payload.source, "source", "direct", 160),
    medium: optionalText(payload.medium, "medium", "none", 160),
    campaign: optionalText(payload.campaign, "campaign", "(none)", 160),
    consentVersion: starlightReleasePushConsentVersion,
    consentedAt: now(),
  };
}

export function createStarlightReleasePushService({ repository, now = () => new Date() }) {
  return {
    async subscribe(payload) {
      if (typeof payload?.website === "string" && payload.website.trim() !== "") return;
      await repository.upsertSubscription(sanitizeSubscription(payload, now));
    },
    async list() { return repository.listSubscriptions(); },
  };
}
