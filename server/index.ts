import { Database } from "bun:sqlite";

const db = new Database(":memory:", { strict: true });
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY,
      subscription TEXT NOT NULL
  );
`);

const resp = (body: string, opts: object = {}): Response => {
  return new Response(body, {
    ...opts,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};

const server = Bun.serve({
  async fetch(req) {
    const path = new URL(req.url).pathname;

    console.log(req.method, path);

    if (req.method === "GET" && path === "/vapidPublicKey") {
      return resp(process.env.VAPID_PUBLIC_KEY!);
    } else if (req.method === "POST" && path === "/register") {
      const subscription = await req.text();

      const result = db
        .query<
          { MATCHING_ROWS: number },
          [string]
        >("SELECT COUNT(*) AS MATCHING_ROWS FROM push_subscriptions WHERE subscription = ?;")
        .get(subscription);

      if ((result?.MATCHING_ROWS ?? 0) === 0) {
        db.run("INSERT INTO push_subscriptions (subscription) VALUES (?);", [
          subscription,
        ]);
      } else {
        console.log("Subscription already exists, skipping");
      }

      return resp("", { status: 201 });
    } else {
      // 404s
      return resp("Page not found", { status: 200 });
    }
  },
});

// Use the web-push library to hide the implementation details of the communication
// between the application server and the push service.
// For details, see https://tools.ietf.org/html/draft-ietf-webpush-protocol and
// https://tools.ietf.org/html/draft-ietf-webpush-encryption.
import webPush from "web-push";

if (
  !process.env.MAIL_TO ||
  !process.env.VAPID_PUBLIC_KEY ||
  !process.env.VAPID_PRIVATE_KEY
) {
  console.log(
    "You must set the MAIL_TO, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY " +
      "environment variables. You can use the following ones:",
  );
  console.log(server.url);
  console.log(webPush.generateVAPIDKeys());
}
// Set the keys used for encrypting the push messages.
webPush.setVapidDetails(
  process.env.MAIL_TO!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

setInterval(
  () => {
    db.query<{ subscription: string }, []>(
      "SELECT subscription FROM push_subscriptions;",
    )
      .all()
      .forEach(({ subscription: subscriptionJson }) => {
        const subscription = JSON.parse(subscriptionJson);
        console.log(`sending heartbeat to ${JSON.stringify(subscription)}`);
        webPush
          .sendNotification(subscription, "heartbeat")
          .then((v) => {
            console.log(`sent heartbeat: ${JSON.stringify(v)}`);
          })
          .catch((err) => {
            console.log(`failed to send heartbeat: ${err}`);
          });
      });
  },
  Number.parseInt(process.env.PUSH_INTERVAL_SECONDS ?? "1") * 1000,
);
