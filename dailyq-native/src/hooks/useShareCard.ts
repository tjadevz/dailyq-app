import { useRef } from "react";
import type { RefObject } from "react";
import { Share } from 'react-native'
import { View } from 'react-native'
import { captureRef } from 'react-native-view-shot'

export function useShareCard(): {
  shareCardRef: RefObject<View>;
  shareCard: () => Promise<void>;
} {
  const shareCardRef = useRef<View | null>(null);

  const shareCard = async () => {
    try {
      if (!shareCardRef.current) {
        console.warn("ShareCard ref is null; nothing to share.");
        return;
      }

      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1.0,
      });

      // iOS uses `url` for images, not `message`.
      await Share.share({ url: uri });
    } catch (e) {
      console.error("Failed to share card:", e);
    }
  };

  return { shareCardRef, shareCard };
}

