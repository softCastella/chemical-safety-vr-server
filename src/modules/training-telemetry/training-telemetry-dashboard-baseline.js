import { readFileSync } from "node:fs";

export const dashboardBaseline = JSON.parse(readFileSync(
  new URL("./training-telemetry-dashboard-baseline.json", import.meta.url),
  "utf8",
));
