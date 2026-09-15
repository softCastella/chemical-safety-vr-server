(function (global) {
  "use strict";

  const firebaseVersion = "12.18.0";
  const attributionStorageKey = "starlight_utm_v1";
  let sdkPromise;

  function readAttribution() {
    const query = new URLSearchParams(global.location.search);
    let stored = {};
    try {
      stored = JSON.parse(
        global.sessionStorage.getItem(attributionStorageKey) || "{}",
      );
    } catch (_) {
      stored = {};
    }
    return {
      source: query.get("utm_source") || stored.utm_source || "",
      medium: query.get("utm_medium") || stored.utm_medium || "",
      campaign: query.get("utm_campaign") || stored.utm_campaign || "",
    };
  }

  function loadSdk() {
    sdkPromise ||= Promise.all([
      import(
        `https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-app.js`
      ),
      import(
        `https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-messaging.js`
      ),
    ]);
    return sdkPromise;
  }

  function waitForInstallationId(messagingSdk, messaging) {
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      const timeout = global.setTimeout(() => {
        unsubscribe();
        reject(new Error("FCM registration timed out"));
      }, 15000);
      unsubscribe = messagingSdk.onRegistered(messaging, (installationId) => {
        global.clearTimeout(timeout);
        unsubscribe();
        resolve(installationId);
      });
    });
  }

  async function subscribe(locale) {
    if (!("serviceWorker" in navigator) || !("Notification" in global)) {
      return "unsupported";
    }

    const runtimeConfig = global.STARLIGHT_RELEASE_PUSH_CONFIG;
    if (!runtimeConfig?.firebase || !runtimeConfig?.vapidKey) {
      throw new Error("FCM web push configuration is missing");
    }

    const [appSdk, messagingSdk] = await loadSdk();
    if (!(await messagingSdk.isSupported())) return "unsupported";

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const registration = await navigator.serviceWorker.register(
      "/play/release-push-worker.js",
      { scope: "/play/release-push/" },
    );
    const app = appSdk.getApps().length
      ? appSdk.getApp()
      : appSdk.initializeApp(runtimeConfig.firebase);
    const messaging = messagingSdk.getMessaging(app);
    const installationIdPromise = waitForInstallationId(messagingSdk, messaging);
    await messagingSdk.register(messaging, {
      vapidKey: runtimeConfig.vapidKey,
      serviceWorkerRegistration: registration,
    });
    const installationId = await installationIdPromise;

    const attribution = readAttribution();
    const response = await fetch("/api/starlight-release-push/subscriptions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId,
        locale,
        consent: true,
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        website: "",
      }),
    });
    if (!response.ok) throw new Error("FCM registration save failed");
    return "subscribed";
  }

  global.starlightReleasePush = Object.freeze({ subscribe });
})(window);
