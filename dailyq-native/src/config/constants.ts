/**
 * Design tokens – single source of truth (plan sectie 4 / Figma alignment).
 * Values aligned with Next.js src/app/page.tsx (COLORS, GLASS, CALENDAR, JOKER, MODAL).
 * Used across Today, Calendar, modals, onboarding.
 */
import type { ViewStyle } from "react-native";

export const COLORS = {
  BACKGROUND: "#F4F6F9",
  BACKGROUND_GRADIENT: "linear-gradient(to bottom, #F4F6F9, #EEF2F7)",
  TEXT_PRIMARY: "#1F2937",
  TEXT_SECONDARY: "rgba(107,114,128,1)",
  TEXT_TERTIARY: "rgba(107,114,128,0.9)",
  TEXT_MUTED: "rgba(156,163,175,1)",
  TEXT_FUTURE: "rgba(209,213,219,0.8)",
  ACCENT: "#8B5CF6",
  ACCENT_LIGHT: "#A78BFA",
  HEADER_Q: "#F59E0B",
} as const;

export const GLASS = {
  BG: "rgba(255,255,255,0.5)",
  STRONG_BG: "rgba(255,255,255,0.95)",
  BORDER: "1px solid rgba(255,255,255,0.6)",
  SHADOW: "0 8px 32px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.8)",
  TAB_SHADOW: "0 2px 12px rgba(0,0,0,0.05)",
  BLUR: "blur(40px)",
  CARD_BG: "rgba(255,255,255,0.5)",
  NAV_BG: "rgba(255,255,255,0.5)",
  NAV_BORDER: "1px solid rgba(255,255,255,0.4)",
} as const;

export const CALENDAR = {
  /** Full purple for current day only */
  TODAY_AND_ANSWERED_BG: "#8B5CF6",
  /** Answered past days: slightly faded purple */
  ANSWERED_FADED_BG: "rgba(139,92,246,0.5)",
  /** Current day edge: outer purple, small white spacing */
  TODAY_EDGE: "0 0 0 2px #FFFFFF, 0 0 0 5px #8B5CF6",
  TODAY_EDGE_INSET: "inset 0 0 0 3px rgba(139,92,246,0.9), inset 0 0 0 1px rgba(255,255,255,0.9)",
  CELL_SHADOW: "0 2px 6px rgba(139,92,246,0.25)",
  /** Missed days: edge only, no fill */
  MISSED_EDGE: "inset 0 0 0 2px rgba(156,163,175,0.45)",
  MISSED_COLOR: "rgba(156,163,175,1)",
  FUTURE_BG: "rgba(255,255,255,0.15)",
  FUTURE_BORDER: "1px solid rgba(229,231,235,0.25)",
  FUTURE_COLOR: "rgba(209,213,219,0.5)",
  /** Past days before account existed */
  BEFORE_START_BG: "rgba(255,255,255,0.22)",
  BEFORE_START_BORDER: "1px solid rgba(229,231,235,0.35)",
  BEFORE_START_COLOR: "rgba(156,163,175,0.78)",
  BORDER_RADIUS: "50%",
} as const;

export const JOKER = {
  GRADIENT: "linear-gradient(to bottom right, #FEF3C7, #FDE68A, #FBBF24)",
  BORDER: "1px solid rgba(251,191,36,0.4)",
  TEXT: "#92400E",
  SHADOW: "0 4px 12px rgba(251,191,36,0.22)",
} as const;

/** Calendar day cell when filled with a joker (faded gold) */
export const CALENDAR_JOKER = {
  BACKGROUND: "rgba(251,191,36,0.55)",
  BORDER: "1px solid rgba(251,191,36,0.45)",
  SHADOW: "0 1px 4px rgba(251,191,36,0.2)",
} as const;

/** Modal enter animation duration (ms) */
export const MODAL_ENTER_MS = 200;
/** Modal exit animation duration (ms) */
export const MODAL_CLOSE_MS = 200;

/** Shared modal styles for overlays (React Native ViewStyle) */
export const MODAL: {
  WRAPPER: ViewStyle;
  BACKDROP: ViewStyle;
  CARD: ViewStyle;
  CARD_WIDE: ViewStyle;
  CLOSE_BUTTON: ViewStyle;
} = {
  WRAPPER: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  BACKDROP: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 48,
  },
  CARD: {
    position: "relative",
    zIndex: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 32,
    padding: 24,
    width: "90%",
    maxWidth: 384,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    elevation: 8,
  },
  CARD_WIDE: {
    position: "relative",
    zIndex: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 32,
    padding: 24,
    width: "90%",
    maxWidth: 512,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    elevation: 8,
  },
  CLOSE_BUTTON: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(243,244,246,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
};
