import { useState } from "react";
import {
  Button,
  TextField,
  DatePicker,
  TimeField,
  Form,
  GridListItem,
  GridList,
  Label,
} from "./components";
import { DateValue, Selection, TimeValue } from "react-aria-components";
import { parseDate, parseTime } from "@internationalized/date";
import clsx from "clsx";

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

interface Alarm {
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

function App() {
  const [alarms, setAlarms] = useState<Alarm[]>(() =>
    sortAlarms(
      JSON.parse(localStorage.getItem("alarms") || "[]").map(
        ({
          name: name,
          date: date,
          time: time,
          warnings: warnings,
        }: {
          name: string;
          date: string;
          time: string;
          warnings: string[];
        }) => ({
          name,
          date: parseDate(date),
          time: parseTime(time),
          warnings: new Set(warnings),
        }),
      ),
    ),
  );
  const [name, setName] = useState<string | undefined>();
  const [date, setDate] = useState<DateValue | undefined>();
  const [time, setTime] = useState<TimeValue | undefined>();
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

  const resetForm = () => {
    setName(undefined);
    setDate(undefined);
    setTime(undefined);
    setWarnings(new Set(["5m"]));
  };

  const createAlarm = (e: React.FormEvent<HTMLFormElement>) => {
    // Prevent default browser page refresh.
    e.preventDefault();

    if (name === undefined || date === undefined || time === undefined) {
      alert("Please fill out all fields.");
    } else {
      updateAlarms([
        { name: name, date: date, time: time, warnings: warnings },
        ...alarms,
      ]);
      resetForm();
    }
  };

  return (
    <div className="flex flex-col w-4/5 mt-3 mx-auto">
      <h1 className="text-3xl mb-3">Alarms</h1>

      <Form onSubmit={createAlarm}>
        <TextField
          label="Name"
          name="name"
          isRequired
          onChange={(v) => setName(v)}
        />
        <DatePicker
          label="Date"
          name="date"
          isRequired
          onChange={(v) => setDate(v)}
        />
        <TimeField
          label="Time"
          name="time"
          isRequired
          onChange={(v) => setTime(v)}
        />

        <Label id="warnings-label">Warnings</Label>
        <GridList
          selectionMode="multiple"
          defaultSelectedKeys={warnings}
          onSelectionChange={(keys) => setWarnings(keys)}
          aria-labelledby="warnings-label"
          className="max-h-[33vh]"
        >
          {allWarnings.map((option) => (
            <GridListItem key={option} id={option}>
              {option}
            </GridListItem>
          ))}
        </GridList>

        <Button type="submit" variant="primary" className="mt-4">
          Create alarm
        </Button>
      </Form>

      <Button
        variant="destructive"
        type="button"
        onPress={() => updateAlarms([])}
        className="mt-2"
      >
        Clear alarms
      </Button>

      <ul className="mt-3 flex space-x-3 space-y-2 justify-start">
        {alarms.map((alarm, i) => (
          <li
            key={i}
            className={clsx(
              "outline outline-blue-600 dark:outline-blue-500 forced-colors:outline-[Highlight]",
              "outline-offset-2 group items-center bg-white dark:bg-zinc-900 forced-colors:bg-[Field]",
              "border-2 rounded-lg border-gray-300 dark:border-zinc-500",
              "forced-colors:border-[ButtonBorder] outline-0 block w-fit px-2 py-1.5",
              "text-sm text-gray-500 dark:text-zinc-400 font-medium cursor-default",
            )}
          >
            <h2 className="text-gray-300">{alarm.name}</h2>
            <p>
              {alarm.date.toString()} {alarm.time.toString()}
            </p>
            <p>Warnings: {Array.from(alarm.warnings).join(", ")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
