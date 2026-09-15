(function () {
  "use strict";

  const host = document.querySelector("[data-dashboard-switcher]");
  if (!host) return;

  const dashboards = [
    { path: "/server/", label: "서버 대시보드" },
    { path: "/starlight-sudoku/", label: "별빛 스도쿠" },
    { path: "/chemical-safety-training-vr/", label: "화학 안전 VR" },
  ];
  const currentPath = dashboards.find(({ path }) => window.location.pathname.startsWith(path))?.path;

  const select = document.createElement("select");
  select.className = "dashboard-switcher__select";
  select.setAttribute("aria-label", "다른 대시보드로 이동");
  for (const dashboard of dashboards) {
    const option = document.createElement("option");
    option.value = dashboard.path;
    option.textContent = dashboard.label;
    option.selected = dashboard.path === currentPath;
    select.append(option);
  }
  select.addEventListener("change", () => window.location.assign(select.value));

  const logout = document.createElement("button");
  logout.type = "button";
  logout.className = "dashboard-switcher__logout";
  logout.textContent = "로그아웃";
  logout.addEventListener("click", async () => {
    logout.disabled = true;
    try {
      await fetch("/api/server-status/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.location.assign("/server/login");
    }
  });

  host.classList.add("dashboard-switcher");
  host.append(select, logout);
})();
