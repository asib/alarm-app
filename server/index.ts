import { Database } from "bun:sqlite";

const db = new Database(":memory:");
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
      const data = await req.json();

      const result = db.run(
        "INSERT INTO push_subscriptions (subscription) VALUES (?);",
        [JSON.stringify(data.subscription)],
      );

      return resp("", { status: 201 });
    } else {
      // 404s
      return resp("Page not found", { status: 404 });
    }

    // if (req.method === "POST" && path === "sendNotification") {
    //   const data = await req.json()
    //   const subscription = data.subscription;
    //   const payload = null;
    //   const options = {
    //     TTL: data.ttl,
    //   };

    //   setTimeout(function () {
    //     webPush
    //       .sendNotification(subscription, payload, options)
    //       .then(function () {
    //         return new Response("", {status: 201});
    //       })
    //       .catch(function (error) {
    //         console.log(error);
    //         return new Response("", {status: 500});
    //       });
    //   }, data.delay * 1000);
    // }
  },
});

// Use the web-push library to hide the implementation details of the communication
// between the application server and the push service.
// For details, see https://tools.ietf.org/html/draft-ietf-webpush-protocol and
// https://tools.ietf.org/html/draft-ietf-webpush-encryption.
import webPush from "web-push";

if (
  !process.env.HOST ||
  !process.env.VAPID_PUBLIC_KEY ||
  !process.env.VAPID_PRIVATE_KEY
) {
  console.log(
    "You must set the HOST, VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY " +
      "environment variables. You can use the following ones:",
  );
  console.log(server.url);
  console.log(webPush.generateVAPIDKeys());
}
// Set the keys used for encrypting the push messages.
webPush.setVapidDetails(
  process.env.HOST!,
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
        webPush
          .sendNotification(subscription, "heartbeat")
          .then(() => {
            console.log("sent heartbeat");
          })
          .catch((err) => {
            console.log(`failed to send heartbeat: ${err}`);
          });
      });
  },
  Number.parseInt(process.env.PUSH_INTERVAL_SECONDS ?? "1") * 1000,
);
