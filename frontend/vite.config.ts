import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { rollupOptions: { input: { app: "index.html", region: "region.html" } } },
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
