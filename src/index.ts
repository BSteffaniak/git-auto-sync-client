import WebSocket from "ws";

import dotenv from 'dotenv';

dotenv.config();

function heartbeat(this: any) {
  clearTimeout(this.pingTimeout);

  // Use `WebSocket#terminate()`, which immediately destroys the connection,
  // instead of `WebSocket#close()`, which waits for the close timer.
  // Delay should be equal to the interval at which your server
  // sends out pings plus a conservative assumption of the latency.
  this.pingTimeout = setTimeout(() => {
    this.terminate();
    console.log("Terminated");
  }, 30000 + 1000);
}

const client = new WebSocket(process.env.WEBSOCKET_SERVER_URL!);

client.on("error", console.error);

client.on("open", function () {
  heartbeat.apply(this);
});

client.on("ping", function () {
  heartbeat.apply(this);
});

client.on("close", function clear(this: any) {
  clearTimeout(this.pingTimeout);
});

client.on('message', function message(data) {
  console.log('received: %s', data);
});
