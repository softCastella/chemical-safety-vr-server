import "dotenv/config";
import path from "node:path";

function readInteger(name, fallback, minimum, maximum) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }

  return value;
}

function readBoolean(name, fallback) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") {
    return fallback;
  }
  if (rawValue === "true") {
    return true;
  }
  if (rawValue === "false") {
    return false;
  }

  throw new Error(`${name} must be either true or false.`);
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const defaultUnityTelemetryDirectory = process.env.USERPROFILE
  ? path.join(
      process.env.USERPROFILE,
      "AppData",
      "LocalLow",
      "softCastella",
      "Prototype_Tyche_Jinyoung",
      "tyche-training-telemetry",
    )
  : "";

export const env = Object.freeze({
  nodeEnv,
  port: readInteger("PORT", 3000, 1, 65535),
  enableUnauthenticatedUserCrud: readBoolean(
    "ENABLE_UNAUTHENTICATED_USER_CRUD",
    nodeEnv !== "production",
  ),
  enableLocalTrainingRegistration: readBoolean(
    "ENABLE_LOCAL_TRAINING_REGISTRATION",
    nodeEnv !== "production",
  ),
  localTrainingDataFile:
    process.env.LOCAL_TRAINING_DATA_FILE ??
    "./data/local-training-registrations.jsonl",
  enableLocalTelemetryRead: readBoolean(
    "ENABLE_LOCAL_TELEMETRY_READ",
    nodeEnv !== "production",
  ),
  enableTrainingTelemetryIngest: readBoolean(
    "ENABLE_TRAINING_TELEMETRY_INGEST",
    false,
  ),
  trainingTelemetryUploadToken:
    process.env.TRAINING_TELEMETRY_UPLOAD_TOKEN ?? "",
  enableServerAdmin: readBoolean("ENABLE_SERVER_ADMIN", nodeEnv === "production"),
  vultrApiKey: process.env.VULTR_API_KEY ?? "",
  serverAdminCountryLookup: Object.freeze({
    enabled: readBoolean("ENABLE_SERVER_ADMIN_COUNTRY_LOOKUP", false),
    databasePath: process.env.GEOLITE2_COUNTRY_DB_PATH ?? "",
  }),
  serverAdminPush: Object.freeze({
    enabled: readBoolean("ENABLE_SERVER_ADMIN_PUSH", false),
    vapidPublicKey: process.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? "",
    vapidPrivateKey: process.env.WEB_PUSH_VAPID_PRIVATE_KEY ?? "",
    subject: process.env.WEB_PUSH_SUBJECT ?? "",
    pollIntervalSeconds: readInteger(
      "SERVER_ALERT_POLL_INTERVAL_SECONDS",
      60,
      30,
      3600,
    ),
  }),
  enableContactForm: readBoolean("ENABLE_CONTACT_FORM", false),
  kakaoJavaScriptKey: process.env.KAKAO_JAVASCRIPT_KEY ?? "",
  contact: Object.freeze({
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    fromEmail: process.env.CONTACT_FROM_EMAIL ?? "",
    toEmail: process.env.CONTACT_TO_EMAIL ?? "",
    rateLimitPerHour: readInteger("CONTACT_RATE_LIMIT_PER_HOUR", 5, 1, 100),
  }),
  unityTelemetryDirectory:
    process.env.UNITY_TELEMETRY_DIRECTORY ?? defaultUnityTelemetryDirectory,
  database: Object.freeze({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: readInteger("DB_PORT", 3306, 1, 65535),
    user: process.env.DB_USER ?? "tyche_app",
    password: process.env.DB_PASSWORD ?? "",
    name: process.env.DB_NAME ?? "tyche_training",
    connectionLimit: readInteger("DB_CONNECTION_LIMIT", 10, 1, 100),
  }),
});
