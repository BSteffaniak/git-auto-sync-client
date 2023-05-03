import fs from "fs";

if (fs.existsSync(".env")) {
  console.log(".env already exists");
  process.exit(0);
}

const environment = {
  WEBSOCKET_SERVER_URL: "",
  NODE_ENV: "production",
  MAX_CONNECTION_RETRY_COUNT: "-1",
  CONNECTION_RETRY_DEBOUNCE: "5000",
};

fs.writeFileSync(
  ".env",
  Object.entries(environment)
    .map(([key, value]) => `${key}=${value}\n`)
    .join("")
);

console.log(".env created");
