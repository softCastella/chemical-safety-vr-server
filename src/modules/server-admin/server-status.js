import os from "node:os";
import { readFile, statfs } from "node:fs/promises";
import https from "node:https";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../../config/env.js";

const execFileAsync = promisify(execFile);

const round = (value) => Math.round(value * 100) / 100;
const uptimeLabel = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}일 ${hours}시간 ${minutes}분`;
};

const serviceTargets = Object.freeze([
  { name: "TYCHE WORKS", host: "tycheworks.com", path: "/" },
  { name: "BRAND", host: "tycheworks.com", path: "/brand" },
  { name: "IMMERSA", host: "immersa.tycheworks.com", path: "/" },
  { name: "VR TRAINING", host: "immersa.tycheworks.com", path: "/chemical-safety-training" },
  { name: "SPARK", host: "spark.tycheworks.com", path: "/" },
  { name: "LOOP", host: "loop.tycheworks.com", path: "/" },
]);

function checkService(target) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const request = https.request({
      hostname: "127.0.0.1", port: 443, servername: target.host, path: target.path,
      method: "HEAD", headers: { host: target.host }, rejectUnauthorized: true, timeout: 3000,
    }, (response) => {
      response.resume();
      resolve({ ...target, url: `https://${target.host}${target.path}`, status: response.statusCode === 200 ? "online" : "warning", httpStatus: response.statusCode, responseMs: Date.now() - startedAt });
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", () => resolve({ ...target, url: `https://${target.host}${target.path}`, status: "offline", httpStatus: null, responseMs: null }));
    request.end();
  });
}

function readCertificate() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    const request = https.request({ hostname: "127.0.0.1", port: 443, servername: "tycheworks.com", method: "HEAD", headers: { host: "tycheworks.com" }, rejectUnauthorized: true, timeout: 3000, agent: false });
    request.on("socket", (socket) => socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate(true);
      const domains = (certificate.subjectaltname ?? "").split(", ").map((item) => item.replace(/^DNS:/, "")).filter(Boolean);
      const start = new Date(certificate.valid_from); const expiry = new Date(certificate.valid_to);
      if (!certificate.valid_from || !certificate.valid_to || Number.isNaN(start.valueOf()) || Number.isNaN(expiry.valueOf())) return finish([]);
      finish([{ name: certificate.subject?.CN ?? "tycheworks.com", domains, start: start.toISOString(), expiry: expiry.toISOString(), daysRemaining: Math.ceil((expiry - Date.now()) / 86400000) }]);
    }));
    request.on("response", (response) => response.resume());
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", () => finish([])); request.end();
  });
}

async function readCertificateRenewal() {
  try {
    const { stdout } = await execFileAsync("systemctl", ["show", "certbot.timer", "--property=ActiveState", "--property=NextElapseUSecRealtime"]);
    const values = Object.fromEntries(stdout.trim().split("\n").map((line) => line.split(/=(.*)/s).slice(0, 2)));
    const nextCheck = new Date(values.NextElapseUSecRealtime);
    return {
      enabled: values.ActiveState === "active",
      status: values.ActiveState === "active" ? "자동 갱신 점검 활성" : "자동 갱신 점검 비활성",
      nextCheck: Number.isNaN(nextCheck.valueOf()) ? null : nextCheck.toISOString(),
    };
  } catch {
    return { enabled: null, status: "자동 갱신 상태 확인 불가", nextCheck: null };
  }
}

export const nextInvoiceDate = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

export async function readVultrBilling({ apiKey = env.vultrApiKey, fetchImpl = fetch, now = new Date() } = {}) {
  const invoiceDate = nextInvoiceDate(now);
  if (!apiKey) return { connected: false, status: "API 키 미설정", lastPaymentDate: null, nextInvoiceDate: invoiceDate };
  try {
    const response = await fetchImpl("https://api.vultr.com/v2/account", {
      headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { connected: false, status: `Vultr API 오류 (HTTP ${response.status})`, lastPaymentDate: null, nextInvoiceDate: invoiceDate };
    const account = (await response.json()).account ?? {};
    const lastPayment = new Date(account.last_payment_date);
    return {
      connected: true,
      status: "Vultr API 연결됨",
      lastPaymentDate: Number.isNaN(lastPayment.valueOf()) ? null : lastPayment.toISOString(),
      nextInvoiceDate: invoiceDate,
    };
  } catch {
    return { connected: false, status: "Vultr API 연결 실패", lastPaymentDate: null, nextInvoiceDate: invoiceDate };
  }
}

async function readOperatingSystem() {
  try {
    const release = await readFile("/etc/os-release", "utf8");
    const match = release.match(/^PRETTY_NAME="?([^"\n]+)"?$/m);
    return match?.[1] ?? `${os.type()} ${os.release()}`;
  } catch {
    return `${os.type()} ${os.release()}`;
  }
}

export async function collectServerOverview({ securityEvents = [], trustedIps = [], currentIp = null } = {}) {
  const disk = await statfs("/");
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const totalDisk = disk.blocks * disk.bsize;
  const freeDisk = disk.bavail * disk.bsize;
  const alerts = [];
  if ((totalMemory - freeMemory) / totalMemory >= 0.9) alerts.push("메모리 사용률이 90% 이상입니다.");
  if ((totalDisk - freeDisk) / totalDisk >= 0.85) alerts.push("SSD 사용률이 85% 이상입니다.");
  const cpuCount = Math.max(1, os.cpus().length);
  const load = os.loadavg().map(round);
  const loadPerCpu = round(load[0] / cpuCount);
  const loadState = loadPerCpu >= 1 ? "비정상" : loadPerCpu >= 0.7 ? "주의" : "정상";
  const [services, certificates, certificateRenewal, billing, operatingSystem] = await Promise.all([Promise.all(serviceTargets.map(checkService)), readCertificate(), readCertificateRenewal(), readVultrBilling(), readOperatingSystem()]);
  for (const service of services) if (service.status !== "online") alerts.push(`${service.name} 서비스 응답을 확인해주세요.`);
  if (loadState === "비정상") alerts.push(`1분 시스템 부하가 CPU 코어 수 이상입니다. (${load[0]} / ${cpuCount}코어)`);
  return {
    checkedAt: new Date().toISOString(),
    memory: { total: totalMemory, used: totalMemory - freeMemory, free: freeMemory },
    disk: { total: totalDisk, used: totalDisk - freeDisk, free: freeDisk },
    uptimeLabel: uptimeLabel(os.uptime()),
    load, cpuCount, loadPerCpu, loadState, alerts, securityEvents, services, certificates, certificateRenewal, billing, trustedIps, currentIp,
    serverSpecs: { cpuModel: os.cpus()[0]?.model ?? "확인 불가", cpuCount, architecture: os.arch(), operatingSystem, kernel: os.release() },
    ports: [
      { service: "Nginx HTTP", port: 80, exposure: "외부", status: "online" },
      { service: "Nginx HTTPS", port: 443, exposure: "외부", status: "online" },
      { service: "Express API", port: 3000, exposure: "내부", status: "online" },
      { service: "MySQL", port: 3306, exposure: "내부", status: "online" },
    ],
  };
}
