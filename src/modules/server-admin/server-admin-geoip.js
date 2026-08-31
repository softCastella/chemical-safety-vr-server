import { isIP } from "node:net";

import maxmind from "maxmind";

const privateIpv4 = (ip) => {
  const [first, second] = ip.split(".").map(Number);
  return first === 10 || first === 127 || first === 0 || first >= 224 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254);
};

const privateIpv6 = (ip) => {
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe80:");
};

const unavailable = (countryName) => ({ countryName, countryCode: null });

export function createGeoLiteCountryLookup({ databasePath = "" } = {}) {
  let readerPromise;

  async function lookup(ipAddress) {
    const version = isIP(ipAddress);
    if (!version) return unavailable("IP 형식 오류");
    if ((version === 4 && privateIpv4(ipAddress)) || (version === 6 && privateIpv6(ipAddress))) {
      return unavailable("사설 또는 로컬 IP");
    }
    if (!databasePath) return unavailable("국가 조회 설정 없음");

    try {
      readerPromise ??= maxmind.open(databasePath);
      const record = await readerPromise;
      const country = record.get(ipAddress)?.country;
      if (!country?.iso_code) return unavailable("국가 정보 없음");
      return {
        countryCode: country.iso_code,
        countryName: country.names?.ko ?? country.names?.en ?? country.iso_code,
      };
    } catch {
      return unavailable("국가 조회 불가");
    }
  }

  return {
    async enrichSecurityEvents(events) {
      return Promise.all(events.map(async (event) => ({
        ...event,
        ...(await lookup(event.ipAddress)),
      })));
    },
  };
}
