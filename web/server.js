// Startup file for cPanel "Setup Node.js App" (Phusion Passenger).
// Passenger sets PORT (sometimes a socket path, so it is not parsed as a number).
// Locally: `npm run build && npm start`.
const { createServer } = require("node:http");
const next = require("next");

const port = process.env.PORT || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Claude Water Tracker działa na ${port}`);
  });
});
