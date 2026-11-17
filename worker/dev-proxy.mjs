// Local test server that runs the exact Worker code:  node worker/dev-proxy.mjs
// Then open http://localhost:8765/index.html (the site uses http://localhost:8766 automatically on localhost).
import http from "node:http";
import worker from "./letterboxd-worker.js";

const PORT = 8766;
http.createServer(async (req, res) => {
  const response = await worker.fetch(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers: req.headers.origin ? { Origin: req.headers.origin } : {} }));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(PORT, () => console.log(`Letterboxd dev proxy on http://localhost:${PORT}/?user=<username>`));
