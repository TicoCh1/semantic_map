import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { boundaryPreview } from "./scripts/boundary-preview.mjs";
import { liveBoundaryApi } from "./scripts/boundary-live.mjs";

export default defineConfig({
  base: "./",
  plugins: [react(), boundaryPreview(), liveBoundaryApi()],
  build: { rollupOptions: { input: { app: "index.html", region: "region.html" } } },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
