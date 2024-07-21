import { LegacyRef, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./components";
import {
  Provider,
  defaultTheme,
  TextField,
  DatePicker,
  TimeField,
  ActionGroup,
  Form,
  Item,
  Badge,
  DialogTrigger,
  Dialog,
  Heading,
  Divider,
  Content,
  Text,
  ButtonGroup,
} from "@adobe/react-spectrum";
import { Label } from "@react-spectrum/label";
import { DateValue, Selection, TimeValue } from "react-aria-components";
import { parseDate, parseTime } from "@internationalized/date";
import { DOMRefValue } from "@react-types/shared";
import clsx from "clsx";
import { X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";

const allWarnings = [
  "5m",
  "10m",
  "15m",
  "30m",
  "45m",
  "1h",
  "2h",
  "3h",
  "4h",
  "5h",
  "6h",
  "7h",
  "8h",
  "9h",
  "10h",
  "11h",
  "12h",
  "24h",
  "48h",
  "72h",
];

export interface Alarm {
  name: string;
  date: DateValue;
  time: TimeValue;
  warnings: Selection;
}

function sortAlarms(alarms: Alarm[]) {
  return alarms.sort((a, b) => {
    const dateA = new Date(a.date.toString() + "T" + a.time.toString());
    const dateB = new Date(b.date.toString() + "T" + b.time.toString());
    return dateB.getTime() - dateA.getTime();
  });
}

export function loadAlarms(): Alarm[] {
  return sortAlarms(
    (
      JSON.parse(localStorage.getItem("alarms") || "[]") as Array<{
        name: string;
        date: string;
        time: string;
        warnings: string[];
      }>
    ).map(({ name: name, date: date, time: time, warnings: warnings }) => ({
      name,
      date: parseDate(date),
      time: parseTime(time),
      warnings: new Set(warnings),
    })),
  );
}

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

function App() {
  const [alarms, setAlarms] = useState<Alarm[]>(() => loadAlarms());
  const [name, setName] = useState<string>("");
  const [date, setDate] = useState<DateValue | null>(null);
  const [time, setTime] = useState<TimeValue | null>(null);
  const [warnings, setWarnings] = useState<Selection>(new Set(["5m"]));

  const updateAlarms = (newAlarms: Alarm[]) => {
    const sortedAlarms = sortAlarms(newAlarms);
    setAlarms(sortedAlarms);
    localStorage.setItem(
      "alarms",
      JSON.stringify(
        sortedAlarms.map((a) => ({
          ...a,
          date: a.date.toString(),
          time: a.time.toString(),
          warnings: Array.from(a.warnings),
        })),
      ),
    );
  };

  const resetForm = useCallback(() => {
    setName("");
    setDate(null);
    setTime(null);
    setWarnings(new Set(["5m"]));
  }, [setName, setDate, setTime, setWarnings]);

  const createAlarm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (date !== null && time !== null) {
      updateAlarms([
        { name: name ?? "Alarm", date: date, time: time, warnings: warnings },
        ...alarms,
      ]);
      resetForm();
    }
  };

  // This is needed to apply all the spectrum theme classes to the HTML root element.
  // Without this, the html element has a different background colour to the rest of the app,
  // and this can be visible if you scroll "beyond" the content.
  const providerRef = useRef(null) as LegacyRef<DOMRefValue<HTMLDivElement>>;
  useEffect(() => {
    if (providerRef !== null) {
      if (typeof providerRef === "object") {
        const classes = Array.from(
          providerRef.current?.UNSAFE_getDOMNode()?.classList.values() ?? [],
        );

        classes.forEach((c) => document.documentElement.classList.add(c));
      }
    }
  }, [providerRef]);

  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useRegisterSW({
    onRegisteredSW(_serviceWorkerUrl, registration) {
      if (!registration) return;

      setRegistration(registration);
    },
  });

  const setupNotifications = async () => {
    if (registration === null) return;

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
                (event as any).waitUntil(
                  checkAlarms(loadAlarms(), async (message) => {
                    await registration.showNotification(message);
                  }),
                );
              }
            });
          });
      }
    });
  };

  return (
    <Provider ref={providerRef} theme={defaultTheme}>
      <div className="flex flex-col w-4/5 my-4 mx-auto">
        <h1 className="text-3xl mb-3">Alarms</h1>
        <Button
          variant="secondary"
          onPress={() => {
            setupNotifications();
          }}
        >
          Subscribe
        </Button>
        <Button
          className="mt-2"
          variant="secondary"
          onPress={() => {
            window.location.reload();
          }}
        >
          Refresh
        </Button>

        <Form validationBehavior="native" onSubmit={createAlarm}>
          <TextField
            label="Name"
            name="name"
            onChange={(v) => setName(v)}
            value={name}
          />
          <DatePicker
            label="Date"
            name="date"
            isRequired
            onChange={(v) => setDate(v)}
            value={date}
          />
          <TimeField
            label="Time"
            name="time"
            isRequired
            onChange={(v) => setTime(v)}
            value={time}
          />

          <Label id="warnings-label">Warnings</Label>
          <ActionGroup
            selectionMode="multiple"
            selectedKeys={warnings}
            onSelectionChange={(keys) => setWarnings(keys)}
            aria-labelledby="warnings-label"
          >
            {allWarnings.map((option) => (
              <Item key={option}>{option}</Item>
            ))}
          </ActionGroup>

          <Button type="submit" variant="primary" className="mt-4">
            Create alarm
          </Button>
        </Form>

        <DialogTrigger>
          <Button variant="destructive" type="button" className="mt-2">
            Clear alarms
          </Button>
          {(close) => (
            <Dialog>
              <Heading>Delete All Alarms</Heading>
              <Divider />
              <Content>
                <Text>Are you sure you want to delete all alarms?</Text>
              </Content>
              <ButtonGroup>
                <Button
                  variant="secondary"
                  onPress={close}
                  className="mr-4"
                  autoFocus
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={() => {
                    updateAlarms([]);
                    close();
                  }}
                >
                  Confirm
                </Button>
              </ButtonGroup>
            </Dialog>
          )}
        </DialogTrigger>

        <ul className="mt-3 flex flex-wrap items-start gap-3 justify-items-stretch justify-normal">
          {alarms.map((alarm, i) => (
            <li
              key={i}
              className={clsx(
                "outline outline-blue-600 dark:outline-blue-500 forced-colors:outline-[Highlight]",
                "outline-offset-2 group items-center bg-white dark:bg-zinc-900 forced-colors:bg-[Field]",
                "border-2 rounded-lg border-gray-300 dark:border-zinc-500",
                "forced-colors:border-[ButtonBorder] outline-0 w-fit p-2",
                "text-sm text-gray-500 dark:text-zinc-400 font-medium cursor-default",
                "flex flex-col flex-wrap gap-2 items-start",
              )}
            >
              <div className="relative w-full">
                <DialogTrigger>
                  <Button variant="icon" className="absolute top-0 right-0 p-0">
                    <X size="1rem" />
                  </Button>
                  {(close) => (
                    <Dialog>
                      <Heading>Delete Alarm</Heading>
                      <Divider />
                      <Content>
                        <Text>Are you sure you want to delete this alarm?</Text>
                      </Content>
                      <ButtonGroup>
                        <Button
                          variant="secondary"
                          onPress={close}
                          className="mr-4"
                          autoFocus
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          onPress={() => {
                            updateAlarms(alarms.filter((_, j) => i !== j));
                            close();
                          }}
                        >
                          Confirm
                        </Button>
                      </ButtonGroup>
                    </Dialog>
                  )}
                </DialogTrigger>
              </div>

              <h2 className="dark:text-white text-gray-900 pt-3 self-start">
                {alarm.name}
              </h2>

              <div className="self-start">
                {alarm.date.toString() + " " + alarm.time.toString()}
              </div>
              <div className="flex space-x-2 self-start">
                {Array.from(alarm.warnings).map((warning, i) => (
                  <Badge key={i} variant="neutral">
                    {warning}
                  </Badge>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Provider>
  );
}

export default App;
