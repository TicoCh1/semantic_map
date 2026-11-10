import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  base: "./",
  publicDir: "public_pointcloud",
  // Worker-only dependencies must be optimized at startup, before a worker
  // requests them; late discovery can otherwise serve stale dependency URLs.
  optimizeDeps: { include: ["polygon-clipping", "polylabel", "proj4"] },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        potato: resolve(__dirname, "potato.html"),
        potatoLayouts: resolve(__dirname, "potato-layouts.html")
      }
    }
  },
  resolve: {
    alias: [
      {
        find: "maplibre-gl/dist/maplibre-gl.css",
        replacement: resolve(__dirname, "../frontend/node_modules/maplibre-gl/dist/maplibre-gl.css")
      },
      {
        find: /^maplibre-gl$/,
        replacement: resolve(__dirname, "../frontend/node_modules/maplibre-gl/dist/maplibre-gl.mjs")
      }
    ]
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    fs: {
      allow: [".."]
    }
  }
};
