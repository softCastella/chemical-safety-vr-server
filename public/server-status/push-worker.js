self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title || "서버 상태 알림", {
    body: payload.body || "서버 관리자 대시보드를 확인해주세요.",
    icon: "/server/favicon.svg?v=4",
    badge: "/server/favicon.svg?v=4",
    tag: payload.tag || "server-admin-alert",
    renotify: true,
    data: { url: payload.url || "/server" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/server", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(`${self.location.origin}/server`));
    if (existing) {
      await existing.navigate(targetUrl);
      return existing.focus();
    }
    return clients.openWindow(targetUrl);
  })());
});
