/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXHIBIT_RUNPOD_URL?: string;
  readonly VITE_EXHIBIT_RUNPOD_TOKEN?: string;
  readonly VITE_EXHIBIT_LOCK_RUNPOD_URL?: string;
  readonly VITE_EXHIBIT_IDLE_RESET?: string;
  readonly VITE_EXHIBIT_IDLE_MS?: string;
}
