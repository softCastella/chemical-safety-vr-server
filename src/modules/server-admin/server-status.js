import os from "node:os";
import { statfs } from "node:fs/promises";
import https from "node:https";

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
      finish([{ name: certificate.subject?.CN ?? "tycheworks.com", domains, start: start.toISOString(), expiry: expiry.toISOString(), daysRemaining: Math.ceil((expiry - Date.now()) / 86400000), autoRenewal: "활성" }]);
    }));
    request.on("response", (response) => response.resume());
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", () => finish([])); request.end();
  });
}

export async function collectServerOverview({ securityEvents = [], trustedIps = [] } = {}) {
  const disk = await statfs("/");
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const totalDisk = disk.blocks * disk.bsize;
  const freeDisk = disk.bavail * disk.bsize;
  const alerts = [];
  if ((totalMemory - freeMemory) / totalMemory >= 0.9) alerts.push("메모리 사용률이 90% 이상입니다.");
  if ((totalDisk - freeDisk) / totalDisk >= 0.85) alerts.push("SSD 사용률이 85% 이상입니다.");
  const [services, certificates] = await Promise.all([Promise.all(serviceTargets.map(checkService)), readCertificate()]);
  for (const service of services) if (service.status !== "online") alerts.push(`${service.name} 서비스 응답을 확인해주세요.`);
  return {
    checkedAt: new Date().toISOString(),
    memory: { total: totalMemory, used: totalMemory - freeMemory, free: freeMemory },
    disk: { total: totalDisk, used: totalDisk - freeDisk, free: freeDisk },
    uptimeLabel: uptimeLabel(os.uptime()),
    load: os.loadavg().map(round), alerts, securityEvents, services, certificates, trustedIps,
    ports: [
      { service: "Nginx HTTP", port: 80, exposure: "외부", status: "online" },
      { service: "Nginx HTTPS", port: 443, exposure: "외부", status: "online" },
      { service: "Express API", port: 3000, exposure: "내부", status: "online" },
      { service: "MySQL", port: 3306, exposure: "내부", status: "online" },
    ],
  };
}
