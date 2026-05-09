import { runtimeConfig } from "./runtimeConfig";

const lockedRunpodUrl = runtimeConfig.runpodUrl;

export const exhibitConfig = {
  lockedRunpodUrl,
  lockedRunpodToken: runtimeConfig.runpodToken,
  lockRunpodUrl: Boolean(lockedRunpodUrl) && runtimeConfig.lockRunpodUrl,
  idleResetEnabled: runtimeConfig.idleResetEnabled,
  idleMs: runtimeConfig.idleMs
};
