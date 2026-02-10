export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      // eslint-disable-next-line no-console
      .catch((err) => console.error("SW registration failed", err));
  });
}

