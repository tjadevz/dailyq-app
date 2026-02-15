"use client";

import { useEffect } from "react";

export function PwaStandaloneDetector() {
  useEffect(() => {
    const isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true);

    if (isStandalone) {
      document.body.classList.add("pwa-standalone");
    } else {
      document.body.classList.remove("pwa-standalone");
    }
  }, []);

  return null;
}
