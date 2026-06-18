export const STATIC_DEPLOYMENT_CONTACT_EMAIL = "shengtao.steven.xia@gmail.com";

export const STATIC_DEPLOYMENT_SEARCH_UNAVAILABLE_MESSAGE =
  `Dynamic search is unavailable due to static deployment. For more details or fully functional webapp, contact the author at ${STATIC_DEPLOYMENT_CONTACT_EMAIL}`;

export async function copyStaticDeploymentContactEmail(): Promise<void> {
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
