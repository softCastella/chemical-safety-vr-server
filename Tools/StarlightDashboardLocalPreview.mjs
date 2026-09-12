import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import express from "express";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.STARLIGHT_PREVIEW_PORT || 3018);
const remoteHost = process.env.STARLIGHT_PREVIEW_SSH_HOST || "tycheworks";
const remoteRoot = "/home/linuxuser/workspace/chemical-safety-vr";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const remoteScript = `
const {databasePool}=await import("./src/db/pool.js");
const {createStarlightAnalyticsRepository}=await import("./src/modules/starlight-analytics/starlight-analytics-repository.js");
const {aggregateStarlightEvents}=await import("./src/modules/starlight-analytics/starlight-analytics-aggregation.js");
try {
  const query=JSON.parse(Buffer.from(process.argv[1],"base64url").toString("utf8"));
  const repository=createStarlightAnalyticsRepository(databasePool);
  const [events,hasAnyData]=await Promise.all([repository.listEvents(query),repository.hasAnyEvents()]);
  process.stdout.write(JSON.stringify(aggregateStarlightEvents(events,{dateFrom:query.dateFrom,dateTo:query.dateTo,hasAnyData})));
} finally {await databasePool.end();}
`;

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function date(value, fallback) {
  const result = value || fallback;
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!datePattern.test(result) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }
  return result;
}

function optional(value, maximum = 160) {
  return !value || value === "all" ? null : String(value).slice(0, maximum);
}

function queryFrom(request) {
  const today = new Date();
  const prior = new Date(today);
  prior.setUTCDate(prior.getUTCDate() - 29);
  const dateFrom = date(request.query.from, prior.toISOString().slice(0, 10));
  const dateTo = date(request.query.to, today.toISOString().slice(0, 10));
  if (dateFrom > dateTo) throw new Error("시작일은 종료일보다 늦을 수 없습니다.");
  const stageValue = optional(request.query.stage);
  const stageId = stageValue === null ? null : Number(stageValue);
  if (stageId !== null && (!Number.isInteger(stageId) || stageId < 1 || stageId > 5)) {
    throw new Error("스테이지는 1~5만 선택할 수 있습니다.");
  }
  return {
    dateFrom, dateTo, stageId,
    platform: optional(request.query.platform), locale: optional(request.query.locale),
    source: optional(request.query.source), campaign: optional(request.query.campaign),
  };
}

async function readProductionAggregate(query) {
  const encoded = Buffer.from(JSON.stringify(query)).toString("base64url");
  const command = `cd ${shellQuote(remoteRoot)} && node --input-type=module -e ${shellQuote(remoteScript)} ${shellQuote(encoded)}`;
  const { stdout } = await execFileAsync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", remoteHost, command], {
    timeout: 30000,
    maxBuffer: 12 * 1024 * 1024,
    windowsHide: true,
  });
  return JSON.parse(stdout);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("STARLIGHT_PREVIEW_PORT 값이 올바르지 않습니다.");

const app = express();
app.disable("x-powered-by");
app.get("/", (_request, response) => response.redirect("/starlight-analytics/?local-preview=1"));
app.get("/starlight-analytics", (request, response, next) => request.path.endsWith("/") ? next() : response.redirect("/starlight-analytics/?local-preview=1"));
app.get("/api/starlight-analytics/dashboard", async (request, response) => {
  try {
    const query = queryFrom(request);
    response.set("Cache-Control", "no-store");
    response.json(await readProductionAggregate(query));
  } catch (error) {
    const invalid = error.message?.includes("날짜") || error.message?.includes("시작일") || error.message?.includes("스테이지");
    console.error(`[Starlight preview] ${invalid ? error.message : "운영 집계 조회 실패"}`);
    response.status(invalid ? 400 : 503).json({ error: invalid ? error.message : "운영 집계에 연결하지 못했습니다." });
  }
});
app.get("/api/starlight-release-push/subscriptions", (_request, response) => response.status(503).end());
app.use("/starlight-analytics", express.static(path.join(root, "public", "starlight-analytics"), { index: "index.html" }));
app.use("/server", express.static(path.join(root, "public", "server-status")));

app.listen(port, "127.0.0.1", () => {
  console.log(`Starlight local preview: http://127.0.0.1:${port}/starlight-analytics/?local-preview=1`);
});
