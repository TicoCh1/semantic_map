import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(scriptDir, "../../docs");
const command = process.argv[2];

async function clean() {
  await mkdir(pagesDir, { recursive: true });
  await Promise.all([
    rm(resolve(pagesDir, "assets"), { recursive: true, force: true }),
    rm(resolve(pagesDir, "index.html"), { force: true }),
    rm(resolve(pagesDir, "runtime-config.js"), { force: true }),
    rm(resolve(pagesDir, ".nojekyll"), { force: true })
  ]);
}

async function finalize() {
  await mkdir(pagesDir, { recursive: true });
  const assetsDir = resolve(pagesDir, "assets");
  const workerAssets = (await readdir(assetsDir)).filter(name => /^maplibre-gl-worker-[\w-]+\.js$/.test(name));
  if (!workerAssets.length || (await Promise.all(workerAssets.map(name => stat(resolve(assetsDir, name)))))
    .some(asset => asset.size === 0)) {
    throw new Error("MapLibre worker is missing from the Pages build; semantic and vector layers cannot render.");
  }
  await copyFile(resolve(scriptDir, "../public/runtime-config.js"), resolve(pagesDir, "runtime-config.js"));
  await writeFile(resolve(pagesDir, ".nojekyll"), "", "utf8");
}

if (command === "clean") {
  await clean();
} else if (command === "finalize") {
  await finalize();
} else {
  console.error("Usage: node scripts/pages-output.mjs <clean|finalize>");
  process.exitCode = 1;
}
