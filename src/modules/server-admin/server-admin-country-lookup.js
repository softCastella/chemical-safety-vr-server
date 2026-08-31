import maxmind from "maxmind";

const unavailableCountry = "확인 불가";
const failedCountry = "국가 조회 실패";

function countryLabel(record) {
  const country = record?.country ?? record?.registered_country;
  if (!country) return unavailableCountry;

  const code = country.iso_code;
  const name = country.names?.ko ?? country.names?.en ?? code;
  if (!name) return unavailableCountry;
  return code && name !== code ? `${name} (${code})` : name;
}

export function createServerAdminCountryLookup({
  enabled = false,
  databasePath = "",
  maxmindImpl = maxmind,
  logger = console,
} = {}) {
  if (!enabled) {
    return Object.freeze({
      enabled: false,
      async enrichEvents(events) { return events; },
    });
  }

  if (typeof databasePath !== "string" || databasePath.trim() === "") {
    throw new Error(
      "GEOLITE2_COUNTRY_DB_PATH is required when ENABLE_SERVER_ADMIN_COUNTRY_LOOKUP=true.",
    );
  }

  let readerPromise;
  let lastErrorKey = "";

  async function reader() {
    if (!readerPromise) {
      readerPromise = maxmindImpl.open(databasePath, {
        watchForUpdates: true,
        watchForUpdatesNonPersistent: true,
        watchForUpdatesHook() {
          lastErrorKey = "";
          logger.info?.("GeoLite2 Country database reloaded.");
        },
      }).catch((error) => {
        readerPromise = undefined;
        throw error;
      });
    }
    return readerPromise;
  }

  async function enrichEvents(events) {
    if (!Array.isArray(events) || events.length === 0) return events;

    let lookup;
    try {
      lookup = await reader();
      lastErrorKey = "";
    } catch (error) {
      const errorKey = `${error?.code ?? "UNKNOWN"}:${error?.message ?? "Unknown error"}`;
      if (errorKey !== lastErrorKey) {
        lastErrorKey = errorKey;
        logger.error("GeoLite2 Country database could not be opened.", {
          code: error?.code ?? "UNKNOWN",
          message: error?.message ?? "Unknown error",
          databasePath,
        });
      }
      return events.map((event) => ({ ...event, countryName: failedCountry }));
    }

    return events.map((event) => {
      const ipAddress = event?.ipAddress;
      if (typeof ipAddress !== "string" || !maxmindImpl.validate(ipAddress)) {
        return { ...event, countryName: unavailableCountry };
      }

      try {
        return { ...event, countryName: countryLabel(lookup.get(ipAddress)) };
      } catch {
        return { ...event, countryName: unavailableCountry };
      }
    });
  }

  return Object.freeze({ enabled: true, enrichEvents });
}
