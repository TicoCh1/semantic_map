import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "verify",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../dist/verify",
    emptyOutDir: true
  }
});
