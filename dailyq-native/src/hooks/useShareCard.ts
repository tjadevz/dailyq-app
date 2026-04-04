import { useCallback, useEffect, useRef, useState } from "react";
import type { RefCallback } from "react";
import * as Sharing from "expo-sharing";
import { InteractionManager, View } from "react-native";
import { captureRef } from "react-native-view-shot";

export function useShareCard(): {
  shareCardRefCallback: RefCallback<View>;
  shareCard: () => void;
  shareCaptureVisible: boolean;
} {
  const [shareCaptureVisible, setShareCaptureVisible] = useState(false);
  const [cardMounted, setCardMounted] = useState(false);
  const shareCardRef = useRef<View | null>(null);
  const captureStartedRef = useRef(false);

  const shareCardRefCallback = useCallback<RefCallback<View>>((node) => {
    shareCardRef.current = node;
    setCardMounted(!!node);
    if (!node) {
      captureStartedRef.current = false;
    }
  }, []);

  const shareCard = useCallback(() => {
    captureStartedRef.current = false;
    setShareCaptureVisible(true);
  }, []);

  useEffect(() => {
    if (!shareCaptureVisible || !cardMounted || !shareCardRef.current) return;
    if (captureStartedRef.current) return;
    captureStartedRef.current = true;

    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          if (cancelled || !shareCardRef.current) {
            setShareCaptureVisible(false);
            captureStartedRef.current = false;
            return;
          }
          try {
            const uri = await captureRef(shareCardRef, {
              format: "png",
              quality: 1.0,
            });
            setShareCaptureVisible(false);
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
              await Sharing.shareAsync(uri, {
                mimeType: "image/png",
                dialogTitle: "Deel je antwoord",
                UTI: "public.png",
              });
            } else {
              console.warn("Sharing is not available on this device.");
            }
          } catch (e) {
            console.error("Failed to share card:", e);
            setShareCaptureVisible(false);
          }
        });
      });
    });

    return () => {
      cancelled = true;
      if (typeof handle?.cancel === "function") {
        handle.cancel();
      }
    };
  }, [shareCaptureVisible, cardMounted]);

  return { shareCardRefCallback, shareCard, shareCaptureVisible };
}
