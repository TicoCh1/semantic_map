import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  base: "./",
  publicDir: "public_pointcloud",
  resolve: {
    alias: [
      {
        find: "maplibre-gl/dist/maplibre-gl.css",
        replacement: resolve(__dirname, "../frontend/node_modules/maplibre-gl/dist/maplibre-gl.css")
      },
      {
        find: /^maplibre-gl$/,
        replacement: resolve(__dirname, "../frontend/node_modules/maplibre-gl/dist/maplibre-gl.js")
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
