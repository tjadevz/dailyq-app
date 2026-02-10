export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Check for updates every 60 seconds
        setInterval(() => {
          registration.update();
        }, 60000);

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              // New service worker activated - reload to get latest version
              console.log("New version available - reloading");
              window.location.reload();
            }
          });
        });
      })
      // eslint-disable-next-line no-console
      .catch((err) => console.error("SW registration failed", err));

    // Listen for cache update messages from service worker
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "CACHE_UPDATED") {
        console.log("Cache updated - reloading page");
        window.location.reload();
      }
    });
  });
}

