import { runtimeConfig } from "./runtimeConfig";

export const STATIC_DEPLOYMENT_CONTACT_EMAIL = runtimeConfig.supportEmail;

export const STATIC_DEPLOYMENT_SEARCH_UNAVAILABLE_MESSAGE =
  "Dynamic search is unavailable in this static demo. Connect a backend to enable search." +
  (STATIC_DEPLOYMENT_CONTACT_EMAIL ? ` Contact support at ${STATIC_DEPLOYMENT_CONTACT_EMAIL}` : "");

export async function copyStaticDeploymentContactEmail(): Promise<void> {
  if (!STATIC_DEPLOYMENT_CONTACT_EMAIL) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(STATIC_DEPLOYMENT_CONTACT_EMAIL);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = STATIC_DEPLOYMENT_CONTACT_EMAIL;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
