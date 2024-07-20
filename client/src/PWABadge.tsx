import "./PWABadge.css";

import { useRegisterSW } from "virtual:pwa-register/react";
import { Alarm } from "./App";

interface ServiceWorkerProps {
  alarms: Alarm[];
}

function PWABadge({ alarms }: ServiceWorkerProps) {
  // check for updates every minute
  const period = 1000;

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(serviceWorkerUrl, registration) {
      if (period <= 0) return;

      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          navigator.permissions
            .query({
              name: "periodic-background-sync",
            })
            .then((status) => {
              console.log(status);
              if (status.state === "granted") {
                registration?.periodicSync
                  .register("alarm-check", {
                    // An interval of one second
                    minInterval: 1000,
                  })
                  .then((x) => {
                    console.log(`registering handler: ${x}`);
                    self.addEventListener("periodicsync", (event) => {
                      console.log(`got event: ${event}`);
                      if (event.tag === "alarm-check") {
                        event.waitUntil(checkAlarms(alarms));
                      }
                    });
                  })
                  .catch((e) => {
                    console.log(`failed to get periodic sync permission: ${e}`);
                  });
              }
            });
        }
      });

      registration;

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

  function close() {
    setOfflineReady(false);
    setNeedRefresh(false);
  }

  return (
    <div className="PWABadge" role="alert" aria-labelledby="toast-message">
      {(offlineReady || needRefresh) && (
        <div className="PWABadge-toast">
          <div className="PWABadge-message">
            {offlineReady ? (
              <span id="toast-message">App ready to work offline</span>
            ) : (
              <span id="toast-message">
                New content available, click on reload button to update.
              </span>
            )}
          </div>
          <div className="PWABadge-buttons">
            {needRefresh && (
              <button
                className="PWABadge-toast-button"
                onClick={() => updateServiceWorker(true)}
              >
                Reload
              </button>
            )}
            <button className="PWABadge-toast-button" onClick={() => close()}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PWABadge;

async function registerPeriodicSync(
  period: number,
  serviceWorkerUrl: string,
  registration: ServiceWorkerRegistration,
  alarms: Alarm[],
) {
  if (period <= 0) return;

  setInterval(async () => {
    if ("onLine" in navigator && !navigator.onLine) return;

    const resp = await fetch(serviceWorkerUrl, {
      cache: "no-store",
      headers: {
        cache: "no-store",
        "cache-control": "no-cache",
      },
    });

    if (resp?.status === 200) await registration.update();
  }, period);
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
