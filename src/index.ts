import WebSocket from "ws";
import winston from "winston";

import dotenv from "dotenv";

dotenv.config();

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "debug",
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const MAX_CONNECTION_RETRY_COUNT = parseInt(
  process.env.MAX_CONNECTION_RETRY_COUNT!
);
const CONNECTION_RETRY_DEBOUNCE = parseInt(
  process.env.CONNECTION_RETRY_DEBOUNCE!
);

async function newClient() {
  return new Promise((resolve) => {
    let pingInterval: NodeJS.Timeout | undefined;
    const client = new WebSocket(process.env.WEBSOCKET_SERVER_URL!);

    let opened = false;

    client.on("error", function(...args) {
      logger.error(JSON.stringify(args));

      if (!opened) resolve(false);
    });

    client.on("open", function open(this: any) {
      opened = true;
      logger.info("Connection has successfully been opened");
      client.send(JSON.stringify({ action: "sendmessage", data: "test" }));

      resolve(true);

      pingInterval = setInterval(() => {
        if (!opened) return clearInterval(pingInterval);
        
        logger.info("Sending ping");
        client.ping();
      }, 9 * 60 * 1000);
    });

    client.on("close", async function clear(this: any) {
      logger.info("Closed");

      client.terminate();
      opened = false;
      clearInterval(pingInterval);

      await attemptConnection();
    });

    client.on("message", function message(data) {
      logger.info(`received: ${data}`);
    });
  });
}

async function attemptConnection() {
  for (
    let i = 0;
    MAX_CONNECTION_RETRY_COUNT === -1 || i < MAX_CONNECTION_RETRY_COUNT;
    i++
  ) {
    logger.info(`Attempting connection. Attempt ${i + 1}`);

    if (await newClient()) {
      logger.info("Successfully connected client");
      return;
    }

    await new Promise((resolve) => {
      logger.info(`Failed to connect. Waiting ${CONNECTION_RETRY_DEBOUNCE}ms`);
      setTimeout(resolve, CONNECTION_RETRY_DEBOUNCE);
    });
  }

  console.error("Failed to establish connection to websocket server");
  process.exit(1);
}

await attemptConnection();
