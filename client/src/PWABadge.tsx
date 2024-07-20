import "./PWABadge.css";

import { useRegisterSW } from "virtual:pwa-register/react";
import { Alarm, loadAlarms } from "./App";

const serverUrl = "https://server-wild-wave-7018.fly.dev";

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

async function checkAlarms(alarms: Alarm[]) {
  alarms.forEach((alarm) => {
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
    }
  });
}

function PWABadge() {
  const {
    offlineReady: [offlineReady, _setOfflineReady],
    needRefresh: [needRefresh, _setNeedRefresh],
  } = useRegisterSW({
    onRegisteredSW(_serviceWorkerUrl, registration) {
      if (!registration) return;

      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          registration.pushManager
            .getSubscription()
            .then(async function (subscription) {
              // If a subscription was found, return it.
              if (subscription) {
                console.log(
                  `Existing subscription found: ${JSON.stringify(subscription)}`,
                );
                return subscription;
              }

              // Get the server's public key
              console.log("Getting vapidPublicKey");
              const response = await fetch(serverUrl + "/vapidPublicKey");
              const vapidPublicKey = await response.text();
              // Chrome doesn't accept the base64-encoded (string) vapidPublicKey yet
              // urlBase64ToUint8Array() is defined in /tools.js
              const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

              // Otherwise, subscribe the user (userVisibleOnly allows to specify that we don't plan to
              // send notifications that don't have a visible effect for the user).
              console.log("Creating subscription");
              return await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey,
              });
            })
            .then(async function (subscription) {
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

              console.log("Adding push event listener");
              registration.addEventListener("push", (event) => {
                const payload = (event as any).data?.text() ?? "no payload";
                console.log(`payload: ${JSON.stringify(event)}`);

                if (payload === "heartbeat") {
                  (event as any).waitUntil(checkAlarms(loadAlarms()));
                }
              });
            });
        }
      });
      // if (registration?.active?.state === "activated") {
      //   registerPeriodicSync(period, serviceWorkerUrl, registration, alarms);
      // } else if (registration?.installing) {
      //   registration.installing.addEventListener("statechange", (e) => {
      //     const serviceWorker = e.target as ServiceWorker;
      //     if (serviceWorker.state === "activated")
      //       registerPeriodicSync(
      //         period,
      //         serviceWorkerUrl,
      //         registration,
      //         alarms,
      //       );
      //   });
      // }
    },
  });

  console.log(offlineReady, needRefresh);

  // function close() {
  //   setOfflineReady(false);
  //   setNeedRefresh(false);
  // }

  return null;
  // return (
  //   <div className="PWABadge" role="alert" aria-labelledby="toast-message">
  //     {(offlineReady || needRefresh) && (
  //       <div className="PWABadge-toast">
  //         <div className="PWABadge-message">
  //           {offlineReady ? (
  //             <span id="toast-message">App ready to work offline</span>
  //           ) : (
  //             <span id="toast-message">
  //               New content available, click on reload button to update.
  //             </span>
  //           )}
  //         </div>
  //         <div className="PWABadge-buttons">
  //           {needRefresh && (
  //             <button
  //               className="PWABadge-toast-button"
  //               onClick={() => updateServiceWorker(true)}
  //             >
  //               Reload
  //             </button>
  //           )}
  //           <button className="PWABadge-toast-button" onClick={() => close()}>
  //             Close
  //           </button>
  //         </div>
  //       </div>
  //     )}
  //   </div>
  // );
}

export default PWABadge;

// async function registerPeriodicSync(
//   period: number,
//   serviceWorkerUrl: string,
//   registration: ServiceWorkerRegistration,
//   alarms: Alarm[],
// ) {
//   if (period <= 0) return;

//   setInterval(async () => {
//     if ("onLine" in navigator && !navigator.onLine) return;

//     const resp = await fetch(serviceWorkerUrl, {
//       cache: "no-store",
//       headers: {
//         cache: "no-store",
//         "cache-control": "no-cache",
//       },
//     });

//     if (resp?.status === 200) await registration.update();
//   }, period);
// }
