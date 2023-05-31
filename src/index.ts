import util from "util";
import express, { Express } from "express";
import WebSocket from "ws";
import winston from "winston";
import dotenv from "dotenv";

dotenv.config();

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "error" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

const consoleLogger = function (
  level: string,
  message: string,
  ...params: any[]
) {
  const formatted = util.format(message, ...params);

  if (formatted !== message) {
    logger.log(level, formatted);
    return;
  }

  logger.log(level, message);

  if (params.length > 0) {
    logger.log(level, JSON.stringify(params));
  }
};

console.log = (...args) => consoleLogger("info", ...args);
console.info = (...args) => consoleLogger("info", ...args);
console.error = (...args) => consoleLogger("error", ...args);
console.warn = (...args) => consoleLogger("warn", ...args);

const MAX_CONNECTION_RETRY_COUNT = parseInt(
  process.env.MAX_CONNECTION_RETRY_COUNT!
);
const CONNECTION_RETRY_DEBOUNCE = parseInt(
  process.env.CONNECTION_RETRY_DEBOUNCE!
);

async function newClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let pingInterval: NodeJS.Timeout | undefined;
    const client = new WebSocket(process.env.WEBSOCKET_SERVER_URL!);

    let opened = false;

    client.on("error", function (...args) {
      logger.error(JSON.stringify(args));
    });

    client.on("open", function open(this: any) {
      opened = true;
      logger.info("Connection has successfully been opened");

      pingInterval = setInterval(() => {
        if (!opened) return clearInterval(pingInterval);

        logger.info("Sending ping");
        client.ping();
      }, 9 * 60 * 1000);

      resolve(client);
    });

    client.on("close", async function clear(this: any) {
      logger.info("Closed");

      if (opened) {
        opened = false;
        client.terminate();
        clearInterval(pingInterval);

        await attemptConnection();
      } else {
        reject();
      }
    });

    client.on("message", function message(data) {
      logger.info(`received: ${data}`);
    });
  });
}

async function attemptConnection(): Promise<WebSocket> {
  let attemptNumber = 0;

  while (true) {
    logger.info(`Attempting connection. Attempt ${attemptNumber + 1}`);

    try {
      const ws = await newClient();

      logger.info("Successfully connected client");

      return ws;
    } catch (e: unknown) {
      if (
        MAX_CONNECTION_RETRY_COUNT !== -1 &&
        attemptNumber++ === MAX_CONNECTION_RETRY_COUNT
      ) {
        break;
      }

      await new Promise((resolve) => {
        logger.info(
          `Failed to connect. Waiting ${CONNECTION_RETRY_DEBOUNCE}ms`
        );
        setTimeout(resolve, CONNECTION_RETRY_DEBOUNCE);
      });
    }
  }

  console.error("Failed to establish connection to websocket server");
  process.exit(1);
}

async function startServer(): Promise<Express> {
  return new Promise((resolve) => {
    const app = express();
    const port = 3000;

    app.use(express.json());

    app.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
      resolve(app);
    });
  });
}

console.time("startup");
const [ws, server] = await Promise.all([attemptConnection(), startServer()]);
console.timeEnd("startup");

server.post("/send", (req, res) => {
  console.time("POST /send");
  const { data } = req.body;
  ws.send(JSON.stringify({ action: "sendmessage", data }));
  res.send({ success: true });
  console.timeEnd("POST /send");
});
