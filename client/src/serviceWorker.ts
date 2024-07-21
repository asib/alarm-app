import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { Alarm, loadAlarms } from "./App";

declare let self: ServiceWorkerGlobalScope;
const serverUrl = "https://server-wild-wave-7018.fly.dev";

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

navigator.permissions.query({ name: "notifications" }).then((perm) => {
  if (perm.state !== "granted") {
    console.log("Permission not granted, listening for change");
    perm.addEventListener("change", async () => {
      console.log("Notification permission changed to", perm.state);
      await registerForPush();
    });
  }
});

async function registerForPush() {
  let subscription = await self.registration.pushManager.getSubscription();
  if (subscription) {
    console.log(`Existing subscription found: ${JSON.stringify(subscription)}`);
  } else {
    subscription = await subscribe();
  }

  // Send the subscription details to the server using the Fetch API.
  console.log(
    `Sending subscription to server: ${JSON.stringify(subscription)}`,
  );
  await fetch(serverUrl + "/register", {
    method: "post",
    headers: {
      "Content-type": "application/json",
    },
    body: JSON.stringify({
      subscription: subscription,
    }),
  });

  const registerPushHandler = async () => {
    console.log("Adding push event listener");
    self.registration.active!.addEventListener("push", async (event) => {
      console.log(`payload: ${JSON.stringify(event)}`);
      const payload = (event as any).data?.text() ?? "no payload";

      if (payload === "heartbeat") {
        (event as any).waitUntil(
          checkAlarms(await loadAlarms(), async (message) => {
            await self.registration.showNotification(message);
          }),
        );
      }
    });
  };

  if (self.registration?.active?.state === "activated") {
    await registerPushHandler();
  } else if (self.registration?.installing) {
    self.registration.installing.addEventListener("statechange", async (e) => {
      const serviceWorker = e.target as ServiceWorker;
      if (serviceWorker.state === "activated") await registerPushHandler();
    });
  }
}

async function subscribe() {
  console.log("Getting vapidPublicKey");
  const response = await fetch(serverUrl + "/vapidPublicKey");
  const vapidPublicKey = await response.text();
  // Chrome doesn't accept the base64-encoded (string) vapidPublicKey yet
  // urlBase64ToUint8Array() is defined in /tools.js
  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

  // Otherwise, subscribe the user (userVisibleOnly allows to specify that we don't plan to
  // send notifications that don't have a visible effect for the user).
  console.log("Creating subscription");
  return await self.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedVapidKey,
  });
}

async function checkAlarms(
  alarms: Alarm[],
  showNotification: (message: string) => Promise<void>,
) {
  for (const alarm of alarms) {
    const now = new Date();
    const alarmDateTime = new Date(
      alarm.date.year,
      alarm.date.month - 1,
      alarm.date.day,
      alarm.time.hour,
      alarm.time.minute,
    );
    console.log(`Checking alarm now:${now}, alarm:${alarmDateTime}`);

    if (now > alarmDateTime) {
      console.log(
        `Alarm "${alarm.name}" was supposed to go off at ${alarmDateTime.toTimeString()}, but it's already ${now.toTimeString()}`,
      );
      await showNotification(
        `"${alarm.name}" at ${alarmDateTime.toTimeString()}`,
      );
    }
  }
}

// This function is needed because Chrome doesn't accept a base64 encoded string
// as value for applicationServerKey in pushManager.subscribe yet
// https://bugs.chromium.org/p/chromium/issues/detail?id=802280
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
