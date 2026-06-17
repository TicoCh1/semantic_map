import { mkdir, rm, writeFile } from "node:fs/promises";
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
  await writeFile(
    resolve(pagesDir, "runtime-config.js"),
    "window.__SEMANTIC_MAP_RUNTIME_CONFIG__ = window.__SEMANTIC_MAP_RUNTIME_CONFIG__ || {};\n",
    "utf8"
  );
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
