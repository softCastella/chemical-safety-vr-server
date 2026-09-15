import { badRequest } from "../../lib/app-error.js";

const fixedEventNames = new Set([
  "landing_view", "landing_cta_click", "game_open", "game_ready", "puzzle_start",
  "demo_complete", "store_cta_click", "screen_view", "screen_exit", "session_end",
  "game_exit", "pointer_tap", "cell_select", "number_input", "wrong_input", "erase",
  "memo_toggle", "memo_input", "hint_open", "hint_used", "restart", "pause", "resume",
  "settings_open", "language_open", "language_change", "home_click", "next_stage_click",
  "village_click", "release_notify_open", "release_notify_success", "release_notify_failed",
]);
const stageEvent = /^stage_[1-5]_(?:start|clear)$/;
const identifier = /^[A-Za-z0-9._:-]+$/;
const stringLimits = Object.freeze({
  event_id: 80, anonymous_user_id: 100, session_id: 100, screen_id: 64,
  overlay_id: 64, puzzle_id: 100, locale: 16, source: 100, medium: 100,
  campaign: 160, content: 160, term: 160, target_id: 100, target_type: 64,
});
const numberFields = new Set([
  "elapsed_screen_time", "elapsed_play_time", "remaining_cells", "mistake_count",
  "hint_count", "x_ratio", "y_ratio", "viewport_width", "viewport_height",
]);
const propertyNames = new Set([
  "session_duration", "active_engagement_time", "game_screen_time", "screen_duration",
  "active_play_time", "puzzle_clear_time", "time_to_first_action", "time_to_first_hint",
  "time_to_exit", "attempt", "reason", "interaction_kind", "action",
]);

function safeString(value, field, required = false) {
  if (value === null || value === undefined || value === "") {
    if (required) throw badRequest(`${field} is required.`);
    return null;
  }
  if (typeof value !== "string") throw badRequest(`${field} must be a string.`);
  const result = value.trim();
  if (!result || result.length > stringLimits[field]) throw badRequest(`${field} is invalid.`);
  if (["event_id", "anonymous_user_id", "session_id"].includes(field) && !identifier.test(result)) {
    throw badRequest(`${field} contains unsupported characters.`);
  }
  return result;
}

function safeNumber(value, field) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw badRequest(`${field} must be a non-negative number.`);
  if (["x_ratio", "y_ratio"].includes(field) && result > 1) throw badRequest(`${field} must be between 0 and 1.`);
  if (["remaining_cells", "mistake_count", "hint_count", "viewport_width", "viewport_height"].includes(field) && !Number.isInteger(result)) {
    throw badRequest(`${field} must be an integer.`);
  }
  return result;
}

function safeProperties(raw) {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) throw badRequest("properties must be an object.");
  const result = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!propertyNames.has(key) || value === null || value === undefined) continue;
    if (!["string", "number", "boolean"].includes(typeof value)) continue;
    result[key] = typeof value === "string" ? value.slice(0, 160) : value;
  }
  return result;
}

export function sanitizeStarlightEvent(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw badRequest("Each event must be an object.");
  const eventName = typeof raw.event_name === "string" ? raw.event_name : "";
  if (!fixedEventNames.has(eventName) && !stageEvent.test(eventName)) throw badRequest("event_name is not allowed.");
  const occurredAt = new Date(raw.timestamp ?? raw.occurred_at ?? "");
  if (Number.isNaN(occurredAt.valueOf())) throw badRequest("timestamp must be an ISO date-time.");
  const platform = raw.platform ?? "web";
  if (!new Set(["web", "android"]).has(platform)) throw badRequest("platform is not allowed.");
  const stageId = raw.stage_id === null || raw.stage_id === undefined ? null : Number(raw.stage_id);
  if (stageId !== null && (!Number.isInteger(stageId) || stageId < 1 || stageId > 5)) throw badRequest("stage_id must be between 1 and 5.");
  if (raw.is_interactive !== null && raw.is_interactive !== undefined && typeof raw.is_interactive !== "boolean") {
    throw badRequest("is_interactive must be a boolean.");
  }
  const event = {
    event_id: safeString(raw.event_id, "event_id", true),
    event_name: eventName,
    anonymous_user_id: safeString(raw.anonymous_user_id, "anonymous_user_id", true),
    session_id: safeString(raw.session_id, "session_id", true),
    platform,
    occurred_at: occurredAt,
    stage_id: stageId,
    is_interactive: raw.is_interactive === null || raw.is_interactive === undefined ? null : raw.is_interactive,
    properties: safeProperties(raw.properties),
  };
  for (const field of Object.keys(stringLimits)) {
    if (!(field in event)) event[field] = safeString(raw[field], field);
  }
  for (const field of numberFields) event[field] = safeNumber(raw[field], field);
  if ((event.x_ratio === null) !== (event.y_ratio === null)) throw badRequest("x_ratio and y_ratio must be provided together.");
  return event;
}

export function sanitizeStarlightBatch(body) {
  if (!body || !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 100) {
    throw badRequest("events must contain 1 to 100 items.");
  }
  return body.events.map(sanitizeStarlightEvent);
}
