/// <reference lib="WebWorker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { get } from "idb-keyval";
import { Selection } from "react-aria-components";
import { CalendarDate, Time } from "@internationalized/date";

interface Alarm {
  name: string;
  date: CalendarDate;
  time: Time;
  warnings: Selection;
}

declare let self: ServiceWorkerGlobalScope;
const serverUrl = "https://server-wild-wave-7018.fly.dev";

self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

navigator.permissions.query({ name: "notifications" }).then(async (perm) => {
  if (perm.state !== "granted") {
    console.log("Permission not granted, listening for change");
    perm.addEventListener("change", async () => {
      console.log("Notification permission changed to", perm.state);
      await registerForPush();
    });
  } else {
    console.log("Permission already granted, registering for push");
    await registerForPush();
  }
});

console.log("Adding push event listener");
self.addEventListener("push", (event) => {
  const payload = (event as any).data?.text() ?? "no payload";
  console.log(`payload: ${payload}`);

  if (payload === "heartbeat") {
    event.waitUntil(
      loadAlarms().then((alarms) => {
        checkAlarms(alarms);
      }),
    );
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
    body: JSON.stringify(subscription),
  });
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

async function loadAlarms(): Promise<Alarm[]> {
  return sortAlarms(
    ((await get<Alarm[]>("alarms")) ?? []).map(
      ({ name: name, date: date, time: time, warnings: warnings }) => ({
        name,
        date: new CalendarDate(date.year, date.month, date.day),
        time: new Time(time.hour, time.minute),
        warnings: warnings as Selection,
      }),
    ),
  );
}

function sortAlarms(alarms: Alarm[]) {
  return alarms.sort((a, b) => {
    const dateA = new Date(a.date.toString() + "T" + a.time.toString());
    const dateB = new Date(b.date.toString() + "T" + b.time.toString());
    return dateB.getTime() - dateA.getTime();
  });
}

function checkAlarms(alarms: Alarm[]): Promise<void[]> {
  const notificationPromises = alarms.map((alarm) => {
    const now = new Date();
    const alarmDateTime = new Date(
      alarm.date.year,
      alarm.date.month - 1,
      alarm.date.day,
      alarm.time.hour,
      alarm.time.minute,
    );
    console.log(
      `Checking alarm now:${now.toISOString()}, alarm:${alarmDateTime.toISOString()}`,
    );

    if (now > alarmDateTime) {
      console.log(`Alarm was supposed to go off`);
      return self.registration.showNotification(
        `"${alarm.name}" at ${alarmDateTime.toTimeString()}`,
        { body: "Alarm" },
      );
    }

    return Promise.resolve();
  });

  return Promise.all(notificationPromises);
}

// This function is needed because Chrome doesn't accept a base64 encoded string
// as value for applicationServerKey in pushManager.subscribe yet
// https://bugs.chromium.org/p/chromium/issues/detail?id=802280
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
