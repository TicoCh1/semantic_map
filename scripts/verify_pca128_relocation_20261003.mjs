import { createServer, preview, build } from "../frontend/node_modules/vite/dist/node/index.js";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile } from "node:fs/promises";
import http from "node:http";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "frontend_pcatsne");
const configFile = resolve(root, "vite.config.mjs");
const archive = resolve(app, "data/research/pca128-explanations-20261003");
const explanation = JSON.parse(await readFile(resolve(archive, "pca-axis-explanations.json"), "utf8"));
const image = (await readdir(resolve(archive, "details"))).find(name => name.endsWith(".jpg"));
if (!image) throw new Error("No panorama evidence image retained");
const checks = [];
function request(port, path, method = "GET") {
  return new Promise((resolveRequest, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path, method }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolveRequest({ status: res.statusCode, type: res.headers["content-type"], data: Buffer.concat(chunks) }));
    });
    req.on("error", reject); req.end();
  });
}
async function checkServer(server, kind) {
  const port = server.httpServer.address().port;
  for (const prefix of ["/research/pca128-explanations-20261003", "/data/london_pca128_20261003"]) {
    const json = await request(port, prefix + "/pca-axis-explanations.json");
    if (json.status !== 200 || !json.type.startsWith("application/json") || JSON.stringify(JSON.parse(json.data)) !== JSON.stringify(explanation)) throw new Error("Explanation request failed: " + prefix);
    const index = await request(port, prefix + "/index.html");
    if (index.status !== 200 || !index.type.startsWith("text/html")) throw new Error("Review index failed");
    const jpg = await request(port, prefix + "/details/" + image);
    if (jpg.status !== 200 || jpg.type !== "image/jpeg" || jpg.data[0] !== 255 || jpg.data[1] !== 216) throw new Error("Evidence image failed");
    const head = await request(port, prefix + "/details/" + image, "HEAD");
    if (head.status !== 200 || head.data.length) throw new Error("HEAD failed");
    const traversal = await request(port, prefix + "/%2e%2e/%2e%2e/README.md");
    if (traversal.status !== 403) throw new Error("Archive traversal guard failed");
    const missing = await request(port, prefix + "/absent-file.json");
    if (missing.status !== 404) throw new Error("Missing asset did not return 404");
  }
  checks.push(kind + ": canonical and legacy routes, JSON, HTML, JPEG, HEAD, traversal and missing-asset checks passed");
}
let dev, prod;
try {
  dev = await createServer({ root, configFile, configLoader: "runner", logLevel: "error", server: {host: "127.0.0.1", port: 0} });
  await dev.listen();
  await checkServer(dev, "development");
  const bubble = await request(dev.httpServer.address().port, "/data/london_sae_20261003/bubble-interpretations.json");
  if (bubble.status !== 200 || !JSON.parse(bubble.data)) throw new Error("Current SAE panel data failed");
  const map = await request(dev.httpServer.address().port, "/potato.html");
  if (map.status !== 200) throw new Error("Current Potato page unavailable");
  const outDir = resolve(app, "tmp/pca128-relocation-build-20261003");
  if (!outDir.startsWith(app + "/tmp/") && !outDir.startsWith(app + "\\tmp\\")) throw new Error("Build output outside dedicated workspace temp folder");
  await build({ root, configFile, configLoader: "runner", logLevel: "warn", build: { outDir, copyPublicDir: false, emptyOutDir: true } });
  prod = await preview({ root, configFile, configLoader: "runner", logLevel: "error", build: { outDir }, preview: {host: "127.0.0.1", port: 0} });
  await checkServer(prod, "local production preview");
  console.log(JSON.stringify({ status: "passed", checks, currentPotatoAndSaeData: "passed", build: "passed; public-data copy disabled to avoid recreating deleted duplicates" }));
} finally {
  if (dev) await dev.close();
  if (prod) await new Promise(resolveClose => prod.httpServer.close(resolveClose));
}
