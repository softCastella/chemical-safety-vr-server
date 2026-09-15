self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(
      payload.notification?.title || payload.title || "별빛 스도쿠가 출시됐어요",
      {
        body:
          payload.notification?.body ||
          payload.body ||
          "지금 Google Play에서 만나보세요.",
        icon: payload.notification?.icon || "/play/icons/Icon-192.png",
        badge: "/play/icons/Icon-192.png",
        tag: "starlight-sudoku-release",
        renotify: false,
        data: {
          url:
            payload.fcmOptions?.link ||
            payload.data?.url ||
            payload.url ||
            "/store",
        },
      },
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/store",
    self.location.origin,
  ).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const matchingWindow = windows.find((client) => client.url === targetUrl);
        return matchingWindow ? matchingWindow.focus() : clients.openWindow(targetUrl);
      }),
  );
});
