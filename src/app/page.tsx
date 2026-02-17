"use client";
/* eslint-disable no-console */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Crown,
  CircleHelp,
  Calendar as CalendarIcon,
  Settings as SettingsIcon,
  Check,
  X,
  Bell,
  Globe,
  Info,
  LogOut,
  Instagram,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getNow } from "@/utils/dateProvider";
import { registerServiceWorker } from "./register-sw";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { getStoredLanguage } from "./translations";

type Question = {
  id: string;
  text: string;
  day: string;
};

type Answer = {
  id: string;
  answer_text: string;
};

type TabType = "today" | "calendar" | "settings";

// Design Tokens (Single Source of Truth) – Figma alignment
const COLORS = {
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
};

const GLASS = {
  BG: "rgba(255,255,255,0.5)",
  STRONG_BG: "rgba(255,255,255,0.95)",
  BORDER: "1px solid rgba(255,255,255,0.6)",
  SHADOW: "0 8px 32px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.8)",
  TAB_SHADOW: "0 2px 12px rgba(0,0,0,0.05)",
  BLUR: "blur(40px)",
  CARD_BG: "rgba(255,255,255,0.5)",
  NAV_BG: "rgba(255,255,255,0.5)",
  NAV_BORDER: "1px solid rgba(255,255,255,0.4)",
};

const CALENDAR = {
  /** Full purple for current day only */
  TODAY_AND_ANSWERED_BG: "#8B5CF6",
  /** Answered past days: slightly faded purple (reference image) */
  ANSWERED_FADED_BG: "rgba(139,92,246,0.5)",
  /** Current day edge: outer purple, small white spacing, then cell with number */
  TODAY_EDGE: "0 0 0 2px #FFFFFF, 0 0 0 5px #8B5CF6",
  /** Current day edge drawn inside cell so it does not make the day look bigger (white inner + purple ring) */
  TODAY_EDGE_INSET: "inset 0 0 0 3px rgba(139,92,246,0.9), inset 0 0 0 1px rgba(255,255,255,0.9)",
  /** Subtle shadow for current day cell */
  CELL_SHADOW: "0 2px 6px rgba(139,92,246,0.25)",
  /** Missed days: edge only, no fill (reference image) */
  MISSED_EDGE: "0 0 0 2px rgba(156,163,175,0.45)",
  MISSED_COLOR: "rgba(156,163,175,1)",
  FUTURE_BG: "rgba(255,255,255,0.15)",
  FUTURE_BORDER: "1px solid rgba(229,231,235,0.25)",
  FUTURE_COLOR: "rgba(209,213,219,0.5)",
  /** Past days before account existed: slightly less faded than future so they read as "past" */
  BEFORE_START_BG: "rgba(255,255,255,0.22)",
  BEFORE_START_BORDER: "1px solid rgba(229,231,235,0.35)",
  BEFORE_START_COLOR: "rgba(156,163,175,0.78)",
  BORDER_RADIUS: 8,
};

const JOKER = {
  GRADIENT: "linear-gradient(to bottom right, #FEF3C7, #FDE68A, #FCD34D)",
  BORDER: "1px solid rgba(245,158,11,0.3)",
  TEXT: "#92400E",
  SHADOW: "0 4px 12px rgba(245,158,11,0.2)",
};

const MODAL_CLOSE_MS = 200;

function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/** Fetch today's question for loading-screen preload (same logic as TodayView). */
async function fetchTodayQuestionForPreload(
  lang: "en" | "nl",
  userId: string | undefined
): Promise<Question | null> {
  const dayKey = getLocalDayKey(getNow());
  if (userId === "dev-user") {
    return {
      id: "dev-question-id",
      text: "Waar heb je vandaag om gelachen?",
      day: dayKey,
    };
  }
  try {
    const supabase = createSupabaseBrowserClient();
    const tableName = lang === "en" ? "daily_questions_en" : "questions";
    const queryPromise =
      tableName === "daily_questions_en"
        ? supabase.from(tableName).select("id, question_text, question_date").eq("question_date", dayKey).maybeSingle()
        : supabase.from(tableName).select("id, text, day").eq("day", dayKey).maybeSingle();
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Query timeout")), 2000));
    const result: any = await Promise.race([queryPromise, timeoutPromise]);
    const { data, error } = result;
    if (error) throw error;
    if (data) {
      if (tableName === "daily_questions_en") {
        return { id: data.id, text: data.question_text ?? "", day: data.question_date ?? "" };
      }
      return { id: data.id, text: data.text ?? "", day: data.day ?? "" };
    }
    return null;
  } catch {
    return {
      id: "dev-question-id",
      text: "Waar heb je vandaag om gelachen?",
      day: dayKey,
    };
  }
}

/** Shared modal styles to match joker popup (design + spacing) */
const MODAL: {
  WRAPPER: CSSProperties;
  BACKDROP: CSSProperties;
  CARD: CSSProperties;
  CARD_WIDE: CSSProperties;
  CLOSE_BUTTON: CSSProperties;
} = {
  WRAPPER: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    boxSizing: "border-box",
  },
  BACKDROP: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    backdropFilter: "blur(4px)",
    borderRadius: 48,
  },
  CARD: {
    position: "relative",
    zIndex: 1,
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    border: "1px solid rgba(255,255,255,0.6)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    borderRadius: 32,
    padding: "2rem",
    width: "90%",
    maxWidth: "24rem",
  },
  CARD_WIDE: {
    position: "relative",
    zIndex: 1,
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(40px)",
    WebkitBackdropFilter: "blur(40px)",
    border: "1px solid rgba(255,255,255,0.6)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    borderRadius: 32,
    padding: "2rem",
    width: "90%",
    maxWidth: "32rem",
  },
  CLOSE_BUTTON: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "none",
    background: "rgba(243,244,246,0.8)",
    color: COLORS.TEXT_SECONDARY,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

function formatHeaderDate(date: Date, lang: "en" | "nl"): string {
  return new Intl.DateTimeFormat(lang === "nl" ? "nl-NL" : "en-US", {
    weekday: "long",
    month: lang === "nl" ? "long" : "short",
    day: "numeric",
  }).format(date);
}

function getCalendarStyle({
  hasAnswer,
  isToday,
  isFuture,
  isTooOld,
  isBeforeAccountStart,
}: {
  hasAnswer: boolean;
  isToday: boolean;
  isFuture: boolean;
  isTooOld: boolean;
  isBeforeAccountStart: boolean;
}): React.CSSProperties {
  const style: React.CSSProperties = {
    aspectRatio: "1 / 1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: CALENDAR.BORDER_RADIUS,
    transition: "200ms ease",
  };

  if (isFuture) {
    style.color = CALENDAR.FUTURE_COLOR;
    style.background = CALENDAR.FUTURE_BG;
    style.border = CALENDAR.FUTURE_BORDER;
    return style;
  }
  if (isTooOld || isBeforeAccountStart) {
    style.color = CALENDAR.BEFORE_START_COLOR;
    style.background = CALENDAR.BEFORE_START_BG;
    style.border = CALENDAR.BEFORE_START_BORDER;
    return style;
  }

  /* Answered days: current day = full purple + edge; past answered = faded purple, no edge */
  if (hasAnswer) {
    style.color = "#FFFFFF";
    if (isToday) {
      style.background = CALENDAR.TODAY_AND_ANSWERED_BG;
      style.boxShadow = `${CALENDAR.CELL_SHADOW}, ${CALENDAR.TODAY_EDGE_INSET}`;
    } else {
      style.background = CALENDAR.ANSWERED_FADED_BG;
      style.boxShadow = CALENDAR.CELL_SHADOW;
    }
    return style;
  }

  /* Current day (no answer yet): edge only, no fill – white inner + purple ring */
  if (isToday) {
    style.color = CALENDAR.TODAY_AND_ANSWERED_BG;
    style.background = "#FFFFFF";
    style.boxShadow = CALENDAR.TODAY_EDGE_INSET;
    return style;
  }

  /* Missed days: edge only, no fill (reference – grey outline, transparent interior) */
  style.color = CALENDAR.MISSED_COLOR;
  style.background = "transparent";
  style.boxShadow = CALENDAR.MISSED_EDGE;
  return style;
}

// Development-only: fake user when Supabase is unavailable or not used
const DEV_USER = {
  id: 'dev-user',
  email: 'dev@dailyq.local',
} as const;

/** In development returns a fake user so the app works without Supabase. In production returns the real Supabase user. */
function getCurrentUser(supabaseUser: any): any {
  if (process.env.NODE_ENV === 'development') {
    return supabaseUser ?? DEV_USER;
  }
  return supabaseUser;
}

function Home() {
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [calendarAnswersMap, setCalendarAnswersMap] = useState<
    Map<string, { questionText: string; answerText: string }>
  >(new Map());
  const [recapModal, setRecapModal] = useState<{ open: boolean; count: number | null; total: number | null }>({
    open: false,
    count: null,
    total: null,
  });
  const [initialQuestionDayKey, setInitialQuestionDayKey] = useState<string | null>(null);
  const [initialTodayQuestion, setInitialTodayQuestion] = useState<Question | null | undefined>(undefined);
  const [profile, setProfile] = useState<{
    id: string;
    joker_balance: number;
    last_joker_grant_month: string | null;
  } | null>(null);
  const [showJokerModal, setShowJokerModal] = useState(false);
  const [jokerModalClosing, setJokerModalClosing] = useState(false);
  const jokerModalCloseRef = useRef<HTMLButtonElement>(null);
  const jokerModalClosingRef = useRef(false);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const loadingScreenShownAtRef = useRef<number>(Date.now());
  const LOADING_SCREEN_MIN_MS = 2200;
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [showOnboardingOverlay, setShowOnboardingOverlay] = useState(false);

  const closeJokerModal = () => {
    if (jokerModalClosingRef.current) return;
    jokerModalClosingRef.current = true;
    setJokerModalClosing(true);
    setTimeout(() => {
      setShowJokerModal(false);
      setJokerModalClosing(false);
      jokerModalClosingRef.current = false;
    }, MODAL_CLOSE_MS);
  };
  const grantCheckedRef = useRef(false);
  const lastGrantUserIdRef = useRef<string | null>(null);

  const onCalendarUpdate = (dayKey: string, questionText: string, answerText: string) => {
    setCalendarAnswersMap((prev) => {
      const next = new Map(prev);
      next.set(dayKey, { questionText, answerText });
      return next;
    });
  };

  const onAfterAnswerSaved = async (dayKey: string) => {
    const today = getNow();
    if (getLocalDayKey(today) !== dayKey || !isMonday(today)) return;
    if (!effectiveUser) return;
    if (!shouldShowMondayRecap(effectiveUser, today)) return;
    const { start, end } = getPreviousWeekRange(today);
    const total = getAnswerableDaysInRange(start, end, effectiveUser.created_at);
    if (total === 0) return;
    let count: number;
    if (process.env.NODE_ENV === "development" && effectiveUser.id === "dev-user") {
      count = Math.min(7, total);
    } else {
      count = await fetchPreviousWeekAnswerCount(effectiveUser.id);
    }
    setRecapModal({ open: true, count, total });
  };

  const [recapClosing, setRecapClosing] = useState(false);
  const closeRecapModal = (goToCalendar?: boolean) => {
    const today = getNow();
    if (typeof window !== "undefined") {
      localStorage.setItem("dailyq_recap_" + getLocalDayKey(today), "1");
    }
    setRecapModal((prev) => ({ ...prev, open: false }));
    if (goToCalendar) setActiveTab("calendar");
  };
  const handleRecapClose = (goToCalendar?: boolean) => {
    setRecapClosing(true);
    setTimeout(() => {
      closeRecapModal(goToCalendar);
      setRecapClosing(false);
    }, MODAL_CLOSE_MS);
  };

  useEffect(() => {
    registerServiceWorker();

    const initAuth = async () => {
      try {
        console.log('🔐 Initializing auth...');
        
        const supabase = createSupabaseBrowserClient();
        
        // Check initial auth state - session is automatically restored
        const { data: { user: u } } = await supabase.auth.getUser();
        
        // Development-only auth bypass
        if (!u && process.env.NODE_ENV === 'development') {
          console.log('👤 No user found - using dev user');
          setUser(DEV_USER);
        } else {
          setUser(u);
        }
        const effectiveId = u?.id ?? (process.env.NODE_ENV === 'development' ? DEV_USER.id : undefined);
        if (effectiveId) {
          const storedLang = getStoredLanguage();
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:initAuth-preload',message:'Preload with stored language',data:{storedLang,effectiveId:effectiveId?.slice(0,8)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          const preload = await fetchTodayQuestionForPreload(storedLang, effectiveId);
          setInitialTodayQuestion(preload);
        }
        const elapsed = Date.now() - loadingScreenShownAtRef.current;
        const wait = Math.max(0, LOADING_SCREEN_MIN_MS - elapsed);
        setTimeout(() => setCheckingAuth(false), wait);

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          console.log('🔄 Auth state changed:', _event);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:onAuthStateChange',message:'Auth state changed',data:{event:_event,hasSession:Boolean(session?.user),userId:session?.user?.id?.slice(0,8)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          // In development, keep dev user when session is null so submit still works
          if (process.env.NODE_ENV === "development" && !session?.user) {
            setUser(DEV_USER);
          } else {
            setUser(session?.user ?? null);
          }
          // Preload today's question when user just signed in so TodayView doesn't show "Loading question of the day"
          const effectiveId = session?.user?.id ?? (process.env.NODE_ENV === "development" ? DEV_USER.id : undefined);
          if (effectiveId) {
            const storedLang = getStoredLanguage();
            fetchTodayQuestionForPreload(storedLang, effectiveId).then((preload) => {
              setInitialTodayQuestion(preload);
            }).catch(() => {});
          }
          const elapsed = Date.now() - loadingScreenShownAtRef.current;
          const wait = Math.max(0, LOADING_SCREEN_MIN_MS - elapsed);
          setTimeout(() => setCheckingAuth(false), wait);
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (authError) {
        // If Supabase fails in development, use dev user so app still works
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Supabase auth failed, using dev user');
          setUser(DEV_USER);
          const storedLang = getStoredLanguage();
          const preload = await fetchTodayQuestionForPreload(storedLang, DEV_USER.id);
          setInitialTodayQuestion(preload);
        }
        console.error('Auth error:', authError);
        const elapsed = Date.now() - loadingScreenShownAtRef.current;
        const wait = Math.max(0, LOADING_SCREEN_MIN_MS - elapsed);
        setTimeout(() => setCheckingAuth(false), wait);
      }
    };

    const cleanup = initAuth();
    return () => {
      cleanup?.then(fn => fn?.());
    };
  }, []);

  const effectiveUser = getCurrentUser(user);

  // After login transition: reset scroll so app is full-screen on iOS (no body scroll)
  const hadUserRef = useRef(false);
  useEffect(() => {
    const hasUser = Boolean(effectiveUser?.id);
    if (hasUser && !hadUserRef.current) {
      hadUserRef.current = true;
      if (typeof window !== "undefined") {
        const before = { scrollY: window.scrollY, bodyScrollHeight: document.body.scrollHeight, docClientHeight: document.documentElement.clientHeight, bodyScrollTop: document.body.scrollTop };
        const scrollReset = () => {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          document.documentElement.style.overflow = "hidden";
          document.body.style.overflow = "hidden";
        };
        scrollReset();
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:scroll-reset',message:'Scroll reset after login',data:{before,afterScrollY:window.scrollY},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        // Run again after layout/paint so scroll doesn't reappear
        requestAnimationFrame(() => {
          scrollReset();
          requestAnimationFrame(() => {
            scrollReset();
            fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:scroll-after-raf',message:'Scroll state one frame after reset',data:{scrollY:window.scrollY,bodyScrollHeight:document.body.scrollHeight,docClientHeight:document.documentElement.clientHeight},timestamp:Date.now(),hypothesisId:'H6'})}).catch(()=>{});
          });
        });
      }
    }
    if (!hasUser) hadUserRef.current = false;
  }, [effectiveUser?.id]);

  useEffect(() => {
    if (!effectiveUser?.id) {
      grantCheckedRef.current = false;
      lastGrantUserIdRef.current = null;
      setProfile(null);
      return;
    }
    if (effectiveUser.id === "dev-user") {
      setProfile({ id: "dev-user", joker_balance: 2, last_joker_grant_month: null });
      return;
    }
    if (grantCheckedRef.current && lastGrantUserIdRef.current === effectiveUser.id) return;
    lastGrantUserIdRef.current = effectiveUser.id;
    grantCheckedRef.current = true;

    const supabase = createSupabaseBrowserClient();
    const run = async () => {
      const { data: prof, error: fetchErr } = await supabase
        .from("profiles")
        .select("id, joker_balance, last_joker_grant_month")
        .eq("id", effectiveUser.id)
        .maybeSingle();
      if (fetchErr) {
        console.error("Profile fetch error:", fetchErr);
        grantCheckedRef.current = false;
        return;
      }
      setProfile(prof ?? null);
      const currentMonth = getNow().toISOString().slice(0, 7);
      const lastGrant = prof?.last_joker_grant_month ?? null;
      if (lastGrant !== currentMonth) {
        const { error: rpcErr } = await supabase.rpc("grant_monthly_jokers");
        if (rpcErr) {
          console.error("grant_monthly_jokers error:", rpcErr);
          grantCheckedRef.current = false;
          return;
        }
        const { data: refetched } = await supabase
          .from("profiles")
          .select("id, joker_balance, last_joker_grant_month")
          .eq("id", effectiveUser.id)
          .single();
        if (refetched) setProfile(refetched);
      }
    };
    run();
  }, [effectiveUser?.id]);

  useEffect(() => {
    if (!showJokerModal) return;
    jokerModalCloseRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeJokerModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showJokerModal]);

  if (checkingAuth || showLoadingScreen) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: "100%",
          paddingTop: "env(safe-area-inset-top)",
          boxSizing: "border-box",
          background: COLORS.BACKGROUND,
        }}
      >
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            flex: 1,
            margin: "16px 16px 8px",
            borderRadius: 32,
            overflow: "hidden",
            position: "relative",
            background: GLASS.CARD_BG,
            backdropFilter: GLASS.BLUR,
            WebkitBackdropFilter: GLASS.BLUR,
            border: GLASS.BORDER,
            boxShadow: GLASS.SHADOW,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* Decorative Glass Panels (less faded, more visible) */}
          <div
            className="absolute top-16 -right-24 w-80 h-[500px] rounded-[50px] transform rotate-[15deg]"
            style={{
              background: "linear-gradient(135deg, rgba(243, 232, 255, 0.4) 0%, rgba(221, 214, 254, 0.34) 50%, rgba(196, 181, 253, 0.28) 100%)",
              backdropFilter: "blur(40px)",
              boxShadow: "0 4px 20px rgba(139, 92, 246, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
              pointerEvents: "none",
            }}
          />
          <div
            className="absolute -bottom-32 -left-20 w-96 h-96 rounded-[50px] transform -rotate-[20deg]"
            style={{
              background: "linear-gradient(135deg, rgba(224, 231, 255, 0.4) 0%, rgba(221, 214, 254, 0.34) 50%, rgba(233, 213, 255, 0.28) 100%)",
              backdropFilter: "blur(40px)",
              boxShadow: "0 4px 20px rgba(139, 92, 246, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
              pointerEvents: "none",
            }}
          />
          <div
            className="absolute top-1/3 left-1/4 w-72 h-80 rounded-[45px] transform rotate-[35deg]"
            style={{
              background: "linear-gradient(135deg, rgba(240, 253, 250, 0.34) 0%, rgba(224, 231, 255, 0.3) 50%, rgba(243, 232, 255, 0.26) 100%)",
              backdropFilter: "blur(35px)",
              boxShadow: "0 4px 20px rgba(139, 92, 246, 0.06), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
              pointerEvents: "none",
            }}
          />
          <div
            className="absolute top-24 -left-16 w-56 h-72 rounded-[40px] transform -rotate-[25deg]"
            style={{
              background: "linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(253, 230, 138, 0.26) 50%, rgba(252, 211, 77, 0.22) 100%)",
              backdropFilter: "blur(30px)",
              boxShadow: "0 4px 20px rgba(245, 158, 11, 0.05), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
              pointerEvents: "none",
            }}
          />
          {/* Soft Glow Orbs */}
          <div className="absolute top-20 right-12 w-40 h-40 bg-gradient-to-br from-[#E0E7FF]/32 to-[#DDD6FE]/26 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-32 left-8 w-48 h-48 bg-gradient-to-tr from-[#F3E8FF]/30 to-[#E0E7FF]/24 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-gradient-to-br from-[#FAE8FF]/26 to-[#DBEAFE]/22 rounded-full blur-3xl pointer-events-none" />

          {/* Loading content */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ marginBottom: 32 }}
              >
                <h1 style={{ fontSize: "1.875rem", fontWeight: 600, color: "#1F2937", letterSpacing: "0.08em", textAlign: "center", margin: 0 }}>
                  DailyQ
                </h1>
                <p style={{ fontSize: 14, color: "#9CA3AF", fontWeight: 500, letterSpacing: "0.025em", textAlign: "center", margin: "8px 0 0" }}>
                  One question. Every day.
                </p>
              </motion.div>

              {/* Animated loading dots */}
              <motion.div
                style={{ display: "flex", alignItems: "center", gap: 8 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "rgba(139, 92, 246, 0.6)",
                    }}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!effectiveUser) {
    return <OnboardingScreen />;
  }

  // #region agent log
  if (typeof window !== "undefined") {
    fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:Home-render-app',message:'Rendering main app with user',data:{initialTodayQuestionDefined:initialTodayQuestion !== undefined,userId:effectiveUser?.id?.slice(0,8)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
  }
  // #endregion

  const now = getNow();
  const headerDateLabel = formatHeaderDate(now, lang);

  return (
    <div
      data-app-root
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "100%",
        paddingTop: "env(safe-area-inset-top)",
        boxSizing: "border-box",
        background: COLORS.BACKGROUND,
      }}
    >
      {/* Modal overlay container: direct child of app root so overlay covers header + main + nav */}
      <div ref={modalContainerRef} style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }} aria-hidden />
      {/* Main content card: wraps header + main */}
      <div
        style={{
          flex: 1,
          margin: "16px 16px 8px",
          borderRadius: 32,
          overflow: "hidden",
          position: "relative",
          background: GLASS.CARD_BG,
          backdropFilter: GLASS.BLUR,
          WebkitBackdropFilter: GLASS.BLUR,
          border: GLASS.BORDER,
          boxShadow: GLASS.SHADOW,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Enhanced decorative glass panels */}
        <div
          style={{
            position: "absolute",
            top: 64,
            right: -96,
            width: 320,
            height: 500,
            borderRadius: 50,
            transform: "rotate(15deg)",
            background: "linear-gradient(135deg, rgba(243, 232, 255, 0.32) 0%, rgba(221, 214, 254, 0.26) 50%, rgba(196, 181, 253, 0.2) 100%)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -128,
            left: -80,
            width: 384,
            height: 384,
            borderRadius: 50,
            transform: "rotate(-20deg)",
            background: "linear-gradient(135deg, rgba(224, 231, 255, 0.32) 0%, rgba(221, 214, 254, 0.26) 50%, rgba(233, 213, 255, 0.2) 100%)",
            backdropFilter: "blur(40px)",
            WebkitBackdropFilter: "blur(40px)",
            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "33.333%",
            left: "25%",
            width: 288,
            height: 320,
            borderRadius: 45,
            transform: "rotate(35deg)",
            background: "linear-gradient(135deg, rgba(240, 253, 250, 0.28) 0%, rgba(224, 231, 255, 0.24) 50%, rgba(243, 232, 255, 0.2) 100%)",
            backdropFilter: "blur(35px)",
            WebkitBackdropFilter: "blur(35px)",
            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.06), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 96,
            left: -64,
            width: 224,
            height: 288,
            borderRadius: 40,
            transform: "rotate(-25deg)",
            background: "linear-gradient(135deg, rgba(254, 243, 199, 0.24) 0%, rgba(253, 230, 138, 0.2) 50%, rgba(252, 211, 77, 0.16) 100%)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            boxShadow: "0 4px 20px rgba(245, 158, 11, 0.05), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />
        {/* Soft glow orbs */}
        <div
          style={{
            position: "absolute",
            top: 80,
            right: 48,
            width: 160,
            height: 160,
            background: "linear-gradient(to bottom right, rgba(224, 231, 255, 0.26), rgba(221, 214, 254, 0.2))",
            borderRadius: "50%",
            filter: "blur(48px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 128,
            left: 32,
            width: 192,
            height: 192,
            background: "linear-gradient(to top right, rgba(243, 232, 255, 0.24), rgba(224, 231, 255, 0.18))",
            borderRadius: "50%",
            filter: "blur(48px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: "25%",
            width: 256,
            height: 256,
            background: "linear-gradient(to bottom right, rgba(250, 232, 255, 0.22), rgba(219, 234, 254, 0.18))",
            borderRadius: "50%",
            filter: "blur(48px)",
            pointerEvents: "none",
          }}
        />

        {/* Joker pill - absolute top right (today + calendar only) */}
        {(activeTab === "today" || activeTab === "calendar") && (
          <div style={{ position: "absolute", top: 24, right: 24, zIndex: 20 }}>
            <button
              type="button"
              onClick={() => setShowJokerModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                background: JOKER.GRADIENT,
                border: JOKER.BORDER,
                borderRadius: 9999,
                boxShadow: JOKER.SHADOW,
                cursor: "pointer",
                transition: "transform 150ms ease, box-shadow 150ms ease",
              }}
              title={t("joker_tooltip")}
              aria-label={`Jokers: ${profile?.joker_balance ?? 0}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(245,158,11,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = JOKER.SHADOW;
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.98)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1.05)"; }}
            >
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}>
                <Crown size={10} color={COLORS.HEADER_Q} strokeWidth={2.5} fill="#FCD34D" />
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: JOKER.TEXT }}>{profile?.joker_balance ?? 0}</span>
            </button>
          </div>
        )}

        {/* Header: hide DailyQ + date on calendar tab */}
        <header
          style={{
            padding: "24px",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }} />
          {activeTab !== "calendar" && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: "1.125rem",
                  letterSpacing: "0.12em",
                  fontWeight: 700,
                  color: "#18181B",
                }}
              >
                DailyQ
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#71717A" }}>{headerDateLabel}</span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0, minHeight: 30 }} />
        </header>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            position: "relative",
            background: "transparent",
          }}
        >
          <div
            style={{
              display: activeTab === "today" ? "flex" : "none",
              height: "100%",
            }}
          >
            <TodayView
          user={effectiveUser}
          onCalendarUpdate={onCalendarUpdate}
          onAfterAnswerSaved={onAfterAnswerSaved}
          initialQuestionDayKey={initialQuestionDayKey}
          initialQuestion={initialTodayQuestion}
          onClearInitialDay={() => setInitialQuestionDayKey(null)}
          onShowRecapTest={
            process.env.NODE_ENV === "development"
              ? () => setRecapModal({ open: true, count: 3, total: 7 })
              : undefined
          }
          modalContainerRef={modalContainerRef}
        />
        </div>
        <div
          style={{
            display: activeTab === "calendar" ? "flex" : "none",
            height: "100%",
            width: "100%",
          }}
        >
          <CalendarView
          answersMap={calendarAnswersMap}
          setAnswersMap={setCalendarAnswersMap}
          user={effectiveUser}
          profile={profile}
          onProfileRefetch={async () => {
            if (!effectiveUser?.id || effectiveUser.id === "dev-user") return;
            const supabase = createSupabaseBrowserClient();
            const { data } = await supabase
              .from("profiles")
              .select("id, joker_balance, last_joker_grant_month")
              .eq("id", effectiveUser.id)
              .single();
            if (data) setProfile(data);
          }}
          onAnswerMissedDay={(dayKey) => {
            setInitialQuestionDayKey(dayKey);
            setActiveTab("today");
          }}
          modalContainerRef={modalContainerRef}
        />
        </div>
        <div
          style={{
            display: activeTab === "settings" ? "flex" : "none",
            height: "100%",
          }}
        >
          <SettingsView
            user={effectiveUser}
            onShowLoadingScreen={
              process.env.NODE_ENV === "development"
                ? () => {
                    setShowLoadingScreen(true);
                    setTimeout(() => setShowLoadingScreen(false), 3000);
                  }
                : undefined
            }
            onShowOnboardingScreen={
              process.env.NODE_ENV === "development" ? () => setShowOnboardingOverlay(true) : undefined
            }
          />
        </div>
      </main>
      </div>

      {/* Tab bar */}
      <nav
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          background: GLASS.NAV_BG,
          backdropFilter: GLASS.BLUR,
          WebkitBackdropFilter: GLASS.BLUR,
          border: GLASS.NAV_BORDER,
          borderRadius: 24,
          boxShadow: GLASS.TAB_SHADOW,
          padding: "12px 16px max(12px, env(safe-area-inset-bottom)) 16px",
          margin: "0 16px 24px",
        }}
      >
        <TabButton
          active={activeTab === "today"}
          onClick={() => setActiveTab("today")}
          label={t("tabs_today")}
          icon={<CircleHelp size={24} strokeWidth={1.5} />}
        />
        <TabButton
          active={activeTab === "calendar"}
          onClick={() => setActiveTab("calendar")}
          label={t("tabs_calendar")}
          icon={<CalendarIcon size={24} strokeWidth={1.5} />}
        />
        <TabButton
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
          label={t("tabs_settings")}
          icon={<SettingsIcon size={24} strokeWidth={1.5} />}
        />
      </nav>

      {recapModal.open && recapModal.count !== null && recapModal.total !== null && (
        <div role="dialog" aria-modal="true" style={MODAL.WRAPPER}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: recapClosing ? 0 : 1 }}
            transition={{ duration: 0.2 }}
            style={MODAL.BACKDROP}
            onClick={() => handleRecapClose()}
            aria-hidden
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <MondayRecapModal
              count={recapModal.count}
              total={recapModal.total}
              onClose={() => handleRecapClose()}
              onAnswerMissedDay={() => handleRecapClose(true)}
              isClosing={recapClosing}
            />
          </div>
        </div>
      )}

      {showJokerModal && (() => {
        const balance = profile?.joker_balance ?? 0;
        const balanceStr = String(balance);
        const bodyText = balance === 1
          ? t("joker_modal_body_singular")
          : t("joker_modal_body", { joker_balance: balanceStr });
        const bodyParts = bodyText.split(balanceStr, 2);
        return (
          <div role="dialog" aria-modal="true" aria-label={t("aria_joker_balance")} style={MODAL.WRAPPER}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: jokerModalClosing ? 0 : 1 }}
              transition={{ duration: 0.2 }}
              style={MODAL.BACKDROP}
              onClick={closeJokerModal}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{
                opacity: jokerModalClosing ? 0 : 1,
                scale: jokerModalClosing ? 0.9 : 1,
                y: jokerModalClosing ? 20 : 0,
              }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              style={{ ...MODAL.CARD, textAlign: "center" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                ref={jokerModalCloseRef}
                type="button"
                aria-label={t("common_close")}
                onClick={closeJokerModal}
                style={MODAL.CLOSE_BUTTON}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: JOKER.GRADIENT, margin: "0 auto 1.25rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(245,158,11,0.3)" }}>
                <Crown size={32} color={COLORS.HEADER_Q} strokeWidth={2.5} fill="#FCD34D" />
              </div>
              <p
                style={{
                  fontSize: 16,
                  lineHeight: 1.5,
                  margin: 0,
                  color: COLORS.TEXT_SECONDARY,
                  whiteSpace: "pre-line",
                }}
              >
                {bodyParts.length >= 2 ? (
                  <>
                    {bodyParts[0]}
                    <span style={{ fontWeight: 700, color: COLORS.ACCENT }}>{balanceStr}</span>
                    {bodyParts[1]}
                  </>
                ) : (
                  bodyText
                )}
              </p>
              <button
                type="button"
                onClick={closeJokerModal}
                style={{
                  marginTop: "1.5rem",
                  padding: "12px 24px",
                  borderRadius: 9999,
                  border: "none",
                  background: `linear-gradient(to right, ${COLORS.ACCENT_LIGHT}, ${COLORS.ACCENT})`,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
                }}
              >
                {t("common_ok")}
              </button>
            </motion.div>
          </div>
        );
      })()}

      {showOnboardingOverlay && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: COLORS.BACKGROUND_GRADIENT }}>
          <OnboardingScreen onClose={() => setShowOnboardingOverlay(false)} />
        </div>,
        document.body
      )}
    </div>
  );
}

export default function Page() {
  return (
    <LanguageProvider>
      <Home />
    </LanguageProvider>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  const color = active ? COLORS.ACCENT : COLORS.TEXT_SECONDARY;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        border: "none",
        padding: "4px 8px",
        cursor: "pointer",
        transition: "150ms ease",
        background: "transparent",
        color,
        opacity: active ? 1 : 0.6,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: active ? 600 : 500 }}>{label}</span>
    </button>
  );
}

// ============ ONBOARDING SCREEN ============
function OnboardingScreen({ onClose }: { onClose?: () => void }) {
  const { t } = useLanguage();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // #region agent log
  useEffect(() => {
    if (typeof document === "undefined") return;
    fetch("http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "page.tsx:OnboardingScreen-auth-mounted",
        message: "Auth step mounted",
        data: { hypothesisId: "E", authStepVisible: true },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    const t = setTimeout(() => {
      const form = document.querySelector('form input[type="email"]')?.closest("form") ?? document.querySelector('input[placeholder="Email"]')?.closest("form");
      const h2 = form?.previousElementSibling?.previousElementSibling;
      const p = form?.previousElementSibling;
      const submitBtn = form?.querySelector('button[type="submit"]');
      const toggleBtn = form?.nextElementSibling;
      const h2Style = h2 ? getComputedStyle(h2) : null;
      const pStyle = p ? getComputedStyle(p) : null;
      const formStyle = form ? getComputedStyle(form) : null;
      const btnStyle = submitBtn ? getComputedStyle(submitBtn) : null;
      const toggleStyle = toggleBtn ? getComputedStyle(toggleBtn) : null;
      fetch("http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "page.tsx:OnboardingScreen-auth-spacing",
          message: "Auth step computed spacing",
          data: {
            hypothesisId: "A_B_C_D",
            formFound: !!form,
            h2ClassName: (h2 as HTMLElement)?.className ?? null,
            h2MarginBottom: h2Style?.marginBottom ?? null,
            pClassName: (p as HTMLElement)?.className ?? null,
            pMarginBottom: pStyle?.marginBottom ?? null,
            formClassName: (form as HTMLElement)?.className ?? null,
            formGap: formStyle?.gap ?? null,
            formMarginBottom: formStyle?.marginBottom ?? null,
            submitMarginTop: btnStyle?.marginTop ?? null,
            submitMarginBottom: btnStyle?.marginBottom ?? null,
            toggleMarginTop: toggleStyle?.marginTop ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, []);
  // #endregion

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const isSignUp = !isLoginMode;

      let response;
      if (isSignUp) {
        response = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
        });
      } else {
        response = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
      }

      if (response.error) throw response.error;

      // Auth state will be handled by onAuthStateChange listener
      // No need to manually set user here
    } catch (e: any) {
      const errorMessage = e?.message || "Inloggen mislukt. Probeer het opnieuw.";
      setError(errorMessage);
      console.error("Auth error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: "100%",
        paddingTop: "env(safe-area-inset-top)",
        boxSizing: "border-box",
        background: COLORS.BACKGROUND,
      }}
    >
      {/* Main content card: same as app – wraps glass panels + content */}
      <div
        style={{
          flex: 1,
          margin: "16px 16px 8px",
          borderRadius: 32,
          overflow: "hidden",
          position: "relative",
          background: GLASS.CARD_BG,
          backdropFilter: GLASS.BLUR,
          WebkitBackdropFilter: GLASS.BLUR,
          border: GLASS.BORDER,
          boxShadow: GLASS.SHADOW,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {onClose && (
          <div style={{ position: "absolute", top: 24, right: 24, zIndex: 20 }}>
            <button
              type="button"
              aria-label={t("common_close")}
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "rgba(243,244,246,0.9)",
                color: COLORS.TEXT_SECONDARY,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        )}
        {/* Decorative Glass Panels (less faded, more visible) */}
        <div
          className="absolute top-16 -right-24 w-80 h-[500px] rounded-[50px] transform rotate-[15deg]"
          style={{
            background: "linear-gradient(135deg, rgba(243, 232, 255, 0.4) 0%, rgba(221, 214, 254, 0.34) 50%, rgba(196, 181, 253, 0.28) 100%)",
            backdropFilter: "blur(40px)",
            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />
        <div
          className="absolute -bottom-32 -left-20 w-96 h-96 rounded-[50px] transform -rotate-[20deg]"
          style={{
            background: "linear-gradient(135deg, rgba(224, 231, 255, 0.4) 0%, rgba(221, 214, 254, 0.34) 50%, rgba(233, 213, 255, 0.28) 100%)",
            backdropFilter: "blur(40px)",
            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.08), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />
        <div
          className="absolute top-1/3 left-1/4 w-72 h-80 rounded-[45px] transform rotate-[35deg]"
          style={{
            background: "linear-gradient(135deg, rgba(240, 253, 250, 0.34) 0%, rgba(224, 231, 255, 0.3) 50%, rgba(243, 232, 255, 0.26) 100%)",
            backdropFilter: "blur(35px)",
            boxShadow: "0 4px 20px rgba(139, 92, 246, 0.06), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />
        <div
          className="absolute top-24 -left-16 w-56 h-72 rounded-[40px] transform -rotate-[25deg]"
          style={{
            background: "linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(253, 230, 138, 0.26) 50%, rgba(252, 211, 77, 0.22) 100%)",
            backdropFilter: "blur(30px)",
            boxShadow: "0 4px 20px rgba(245, 158, 11, 0.05), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
            pointerEvents: "none",
          }}
        />
        {/* Soft Glow Orbs */}
        <div className="absolute top-20 right-12 w-40 h-40 bg-gradient-to-br from-[#E0E7FF]/32 to-[#DDD6FE]/26 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-32 left-8 w-48 h-48 bg-gradient-to-tr from-[#F3E8FF]/30 to-[#E0E7FF]/24 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-gradient-to-br from-[#FAE8FF]/26 to-[#DBEAFE]/22 rounded-full blur-3xl pointer-events-none" />

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            padding: "24px",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
          <div className="relative z-10 w-full max-w-[420px] px-10">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="text-center w-full max-w-[420px]"
              >
                <h2 className="text-[32px] leading-tight font-bold text-gray-800" style={{ marginBottom: 64 }}>
                  {isLoginMode ? "DailyQ" : "Create account"}
                </h2>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 20 }}>
                  {!isLoginMode && (
                    <input
                      type="text"
                      placeholder="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-[52px] bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 text-[15px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 text-left"
                      style={{ paddingLeft: 24, paddingRight: 24 }}
                    />
                  )}
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    autoComplete="email"
                    className="w-full h-[52px] bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 text-[15px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 text-left"
                    style={{ paddingLeft: 24, paddingRight: 24 }}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    autoComplete={isLoginMode ? "current-password" : "new-password"}
                    className="w-full h-[52px] bg-white/70 backdrop-blur-xl rounded-2xl border border-white/60 text-[15px] text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 text-left"
                    style={{ paddingLeft: 24, paddingRight: 24 }}
                  />

                  <button
                    type="submit"
                    disabled={submitting || !email.trim() || !password.trim()}
                    className="w-full h-[56px] bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] rounded-full text-white text-[16px] font-semibold shadow-[0_18px_50px_rgba(139,92,246,0.35)] transition-all disabled:opacity-60 disabled:cursor-default"
                    style={{ marginTop: 24, marginBottom: 0 }}
                  >
                    {submitting
                      ? isLoginMode
                        ? t("onboarding_signing_in")
                        : t("onboarding_signing_up")
                      : isLoginMode
                        ? "Sign In"
                        : "Create Account"}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => {
                    setIsLoginMode(!isLoginMode);
                    setError(null);
                  }}
                  disabled={submitting}
                  className="text-[16px] text-gray-500 hover:text-gray-700 transition-colors block w-full"
style={{ marginTop: 0 }}
                  >
                  {isLoginMode ? "Don't have an account? " : "Already have an account? "}
                  <span className="text-[#8B5CF6] font-medium">{isLoginMode ? "Sign up" : "Sign in"}</span>
                </button>

                {error && (
                  <p style={{ color: COLORS.TEXT_SECONDARY, marginTop: "1rem", fontSize: 14 }}>{error}</p>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ STREAK MODAL ============
function fireConfetti(): void {
  if (typeof window === "undefined") return;
  import("canvas-confetti").then(({ default: confetti }) => {
    confetti({
      particleCount: 40,
      spread: 55,
      origin: { y: 0.6 },
      startVelocity: 18,
      colors: ["#8B5CF6", "#A78BFA", "#EEF2F7", "#FFFFFF"],
      ticks: 100,
    });
  });
}

// ============ MONDAY RECAP MODAL (card only; overlay wrapper is in Home) ============
function MondayRecapModal({
  count,
  total,
  onClose,
  onAnswerMissedDay,
  isClosing,
}: {
  count: number;
  total: number;
  onClose: () => void;
  onAnswerMissedDay: () => void;
  isClosing?: boolean;
}) {
  const { t } = useLanguage();
  const isPerfect = total > 0 && count === total;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: isClosing ? 0 : 1, scale: isClosing ? 0.9 : 1, y: isClosing ? 20 : 0 }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
      style={{
        ...MODAL.CARD,
        textAlign: "center",
        maxWidth: "22rem",
        padding: "1.5rem 1.25rem",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" aria-label={t("common_close")} onClick={onClose} style={MODAL.CLOSE_BUTTON}>
        <X size={16} strokeWidth={2.5} />
      </button>
      <p
        style={{
          fontSize: "0.9375rem",
          color: COLORS.TEXT_PRIMARY,
          marginTop: "2rem",
          marginBottom: "1.25rem",
          paddingLeft: "0.5rem",
          paddingRight: "0.5rem",
          lineHeight: 1.5,
        }}
      >
        {t("recap_body", { count: String(count), total: String(total) })}
      </p>
      {isPerfect && (
        <p style={{ fontSize: "1.25rem", fontWeight: 600, color: COLORS.ACCENT, marginBottom: "1rem" }}>🎉</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}>
        {isPerfect ? (
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 44,
              padding: "0 1.5rem",
              borderRadius: 9999,
              border: "none",
              background: `linear-gradient(to right, ${COLORS.ACCENT_LIGHT}, ${COLORS.ACCENT})`,
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.2px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
            }}
          >
            {t("recap_mooi")}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onAnswerMissedDay}
              style={{
                minHeight: 44,
                padding: "0.75rem 1.5rem",
                borderRadius: 9999,
                border: JOKER.BORDER,
                background: JOKER.GRADIENT,
                color: JOKER.TEXT,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.2px",
                cursor: "pointer",
                boxShadow: JOKER.SHADOW,
                whiteSpace: "normal",
                lineHeight: 1.3,
              }}
            >
              {t("recap_answer_missed")}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.5rem",
                fontSize: 14,
                border: "none",
                background: "transparent",
                color: COLORS.TEXT_SECONDARY,
                cursor: "pointer",
              }}
            >
              {t("common_close")}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ============ TODAY VIEW ============
function TodayView({
  user: effectiveUser,
  onCalendarUpdate,
  onAfterAnswerSaved,
  initialQuestionDayKey,
  initialQuestion,
  onClearInitialDay,
  onShowRecapTest,
  modalContainerRef,
}: {
  user: any;
  onCalendarUpdate: ((dayKey: string, questionText: string, answerText: string) => void) | null;
  onAfterAnswerSaved?: (dayKey: string) => void | Promise<void>;
  initialQuestionDayKey?: string | null;
  initialQuestion?: Question | null;
  onClearInitialDay?: () => void;
  onShowRecapTest?: () => void;
  modalContainerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(initialQuestion === undefined);
  const [question, setQuestion] = useState<Question | null>(initialQuestion ?? null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAnswerInput, setShowAnswerInput] = useState(false);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);
  const [editConfirmationClosing, setEditConfirmationClosing] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const delaySubmitSuccessRef = useRef(false);
  const langUsedForPreloadRef = useRef<"en" | "nl" | null>(null);

  const today = new Date();
  const questionNumber = getDayOfYear(today);
  const formattedQuestionNumber = `#${String(questionNumber).padStart(3, "0")}`;

  const closeEditConfirmation = () => {
    setEditConfirmationClosing(true);
    setTimeout(() => {
      setShowEditConfirmation(false);
      setEditConfirmationClosing(false);
    }, MODAL_CLOSE_MS);
  };

  const clearTodayAnswerForDev = () => {
    if (!question || effectiveUser?.id !== "dev-user") return;
    try {
      localStorage.removeItem(`dev-answer-${question.day}`);
      setAnswer(null);
    } catch {}
    setDraft("");
    setShowAnswerInput(false);
  };

  // When parent sets initialQuestion after mount (e.g. preload resolved post sign-in), apply it so we stop showing "Loading question of the day"
  useEffect(() => {
    if (initialQuestion === undefined) return;
    const dayKey = initialQuestionDayKey ?? getLocalDayKey(getNow());
    const isToday = dayKey === getLocalDayKey(getNow());
    if (isToday && initialQuestion) {
      setQuestion(initialQuestion);
      setLoading(false);
    }
  }, [initialQuestion, initialQuestionDayKey]);

  useEffect(() => {
    registerServiceWorker();

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:TodayView-effect',message:'TodayView effect run',data:{initialQuestionDefined:initialQuestion !== undefined,isToday: (initialQuestionDayKey ?? getLocalDayKey(getNow())) === getLocalDayKey(getNow())},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion

    const load = async () => {
      console.log('🔧 TodayView: Starting to load...');
      
      setError(null);

      const dayKey = initialQuestionDayKey ?? getLocalDayKey(getNow());
      const isToday = dayKey === getLocalDayKey(getNow());

      // Use preloaded question only when it was fetched for the current language; when lang changes, refetch from the correct table
      const preloadMatchesLang = langUsedForPreloadRef.current === null || langUsedForPreloadRef.current === lang;
      if (initialQuestion !== undefined && isToday && preloadMatchesLang) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:TodayView-effect',message:'Using preload, skipping fetch',data:{isToday,lang},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        langUsedForPreloadRef.current = lang;
        setQuestion(initialQuestion ?? null);
        setLoading(false);
        if (effectiveUser?.id === "dev-user") {
          try {
            const mockAnswerKey = `dev-answer-${dayKey}`;
            const savedAnswer = localStorage.getItem(mockAnswerKey);
            if (savedAnswer) setAnswer({ id: "dev-answer-id", answer_text: savedAnswer });
          } catch {}
        } else if (effectiveUser) {
          try {
            const supabase = createSupabaseBrowserClient();
            const { data: answerData, error: answerError } = await supabase
              .from("answers")
              .select("id, answer_text")
              .eq("user_id", effectiveUser.id)
              .eq("question_date", dayKey)
              .maybeSingle();
            if (!answerError && answerData) setAnswer(answerData);
          } catch {}
        }
        return;
      }

      setLoading(true);
      try {
        if (typeof window !== "undefined" && !window.navigator.onLine) {
          setOffline(true);
        }

        // In development with dev user, skip database and use mock data
        if (effectiveUser?.id === 'dev-user') {
          console.log('👤 Mock user detected - using mock question immediately');
          langUsedForPreloadRef.current = lang;
          setQuestion({
            id: 'dev-question-id',
            text: 'Waar heb je vandaag om gelachen?',
            day: dayKey,
          });
          
          // Load mock answer from localStorage if exists
          try {
            const mockAnswerKey = `dev-answer-${dayKey}`;
            const savedAnswer = localStorage.getItem(mockAnswerKey);
            if (savedAnswer) {
              setAnswer({
                id: 'dev-answer-id',
                answer_text: savedAnswer,
              });
              console.log('✅ Loaded mock answer from localStorage');
            }
          } catch (e) {
            console.warn('Could not load mock answer from localStorage');
          }
          
          setLoading(false);
          return;
        }

        // Real user - try to load from database
        let questionData = null;

        try {
          console.log('📡 Fetching question from Supabase...');

          const supabase = createSupabaseBrowserClient();
          const tableName = lang === 'en' ? 'daily_questions_en' : 'questions';
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/8b229217-1871-4da8-8258-2778d0f3e809',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'page.tsx:TodayView-fetch',message:'Fetching question',data:{lang,tableName},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
          // #endregion

          const queryPromise =
            tableName === 'daily_questions_en'
              ? supabase
                  .from(tableName)
                  .select('id, question_text, question_date')
                  .eq('question_date', dayKey)
                  .maybeSingle()
              : supabase
                  .from(tableName)
                  .select('id, text, day')
                  .eq('day', dayKey)
                  .maybeSingle();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), 2000)
          );
          const result: any = await Promise.race([queryPromise, timeoutPromise]);
          const { data, error: questionError } = result;

          if (questionError) {
            throw questionError;
          }

          let normalizedQuestion: Question | null = null;
          if (data) {
            if (tableName === 'daily_questions_en') {
              normalizedQuestion = {
                id: data.id,
                text: data.question_text ?? '',
                day: data.question_date ?? ''
              };
            } else {
              normalizedQuestion = {
                id: data.id,
                text: data.text ?? '',
                day: data.day ?? ''
              };
            }
          }
          questionData = normalizedQuestion;

          console.log('✅ Successfully fetched question from Supabase');
        } catch (dbError) {
          // Fallback to mock data on any error
          console.warn('⚠️ Database query failed, using mock data');
          console.log('Error:', dbError);
          questionData = {
            id: 'dev-question-id',
            text: 'Waar heb je vandaag om gelachen?',
            day: dayKey,
          };
        }

        if (!questionData) {
          langUsedForPreloadRef.current = lang;
          setQuestion(null);
          setLoading(false);
          return;
        }

        setQuestion(questionData);
        langUsedForPreloadRef.current = lang;

        // Load existing answer only for real users
        if (effectiveUser && effectiveUser.id !== 'dev-user') {
          try {
            console.log('📝 Checking for existing answer...');
            
            const supabase = createSupabaseBrowserClient();
            const {
              data: answerData,
              error: answerError,
            } = await supabase
              .from("answers")
              .select("id, answer_text")
              .eq("user_id", effectiveUser.id)
              .eq("question_date", dayKey)
              .maybeSingle();

            if (answerError) {
              throw answerError;
            }

            if (answerData) {
              setAnswer(answerData);
              console.log('✅ Found existing answer:', { id: answerData.id, textLength: answerData.answer_text?.length });
            } else {
              console.log('ℹ️ No existing answer found for today');
            }
          } catch (answerError) {
            // Silently ignore answer fetch errors
            console.warn('⚠️ Could not load answer:', answerError);
          }
        } else {
          console.log('👤 Mock user - skipping answer load');
        }
      } catch (e) {
        setError("Er ging iets mis bij het laden van de vraag.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    void load();

    if (typeof window !== "undefined") {
      const handleOnline = () => setOffline(false);
      const handleOffline = () => setOffline(true);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    return undefined;
  }, [initialQuestionDayKey, lang]);

  const handleSubmit = async () => {
    if (!question || !draft.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const today = getNow();
      const dayKey = initialQuestionDayKey ?? getLocalDayKey(today);

      if (!effectiveUser) {
        setError(t("today_login_to_submit"));
        setSubmitting(false);
        return;
      }

      const dayKeyAsDate = new Date(dayKey + "T12:00:00");
      if (isBeforeAccountStart(dayKeyAsDate, effectiveUser)) {
        setError("Deze datum is vóór het begin van je account.");
        setSubmitting(false);
        return;
      }
      if (!canAnswerDate(dayKeyAsDate)) {
        setError("Deze datum valt buiten de 7-dagen periode.");
        setSubmitting(false);
        return;
      }

      // Check if we're editing an existing answer
      const editingExisting = !!answer;

      // In development with dev user, simulate success without database
      if (process.env.NODE_ENV === 'development' && effectiveUser.id === 'dev-user') {
        console.log('✅ Dev mode: Simulating answer submission (not saved to database)');
        
        try {
          const mockAnswerKey = `dev-answer-${dayKey}`;
          localStorage.setItem(mockAnswerKey, draft);
        } catch (e) {
          console.warn('Could not save mock answer to localStorage');
        }
        if (onCalendarUpdate) onCalendarUpdate(dayKey, question.text, draft);
        setDraft('');
        setIsEditMode(false);
        if (initialQuestionDayKey) onClearInitialDay?.();
        if (isMonday(today)) void onAfterAnswerSaved?.(dayKey);

        if (editingExisting) {
          setAnswer({ id: 'dev-answer-id', answer_text: draft });
          setShowEditConfirmation(true);
          setEditConfirmationClosing(false);
          setTimeout(() => {
            setEditConfirmationClosing(true);
            setTimeout(() => {
              setShowEditConfirmation(false);
              setEditConfirmationClosing(false);
            }, MODAL_CLOSE_MS);
          }, 2000);
        } else {
          delaySubmitSuccessRef.current = true;
          setShowSubmitSuccess(true);
          fireConfetti();
          setTimeout(() => {
            setAnswer({ id: 'dev-answer-id', answer_text: draft });
            setShowSubmitSuccess(false);
            delaySubmitSuccessRef.current = false;
            setSubmitting(false);
          }, 1500);
        }
      } else {
        const supabase = createSupabaseBrowserClient();
        try {
          await saveAnswer({
            supabase,
            userId: effectiveUser.id,
            draft,
            dayKey,
            questionText: question.text,
            setAnswer,
            onCalendarUpdate,
            isEdit: editingExisting,
            userCreatedAt: effectiveUser.created_at,
          });
        } catch (dbError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Database save failed in development, simulating success');
            setAnswer({ id: 'dev-answer-id', answer_text: draft });
            if (onCalendarUpdate) onCalendarUpdate(dayKey, question.text, draft);
            if (!editingExisting) fireConfetti();
          } else {
            throw dbError;
          }
        }
        if (editingExisting) {
          setShowEditConfirmation(true);
          setEditConfirmationClosing(false);
          setTimeout(() => {
            setEditConfirmationClosing(true);
            setTimeout(() => {
              setShowEditConfirmation(false);
              setEditConfirmationClosing(false);
            }, MODAL_CLOSE_MS);
          }, 2000);
        } else {
          delaySubmitSuccessRef.current = true;
          setShowSubmitSuccess(true);
          fireConfetti();
          setTimeout(() => {
            setShowSubmitSuccess(false);
            delaySubmitSuccessRef.current = false;
            setSubmitting(false);
          }, 1500);
        }
        setDraft('');
        setIsEditMode(false);
        console.log('✅ Real user submission complete - answer set, draft cleared, edit mode off');
        if (initialQuestionDayKey) onClearInitialDay?.();
        if (isMonday(today)) void onAfterAnswerSaved?.(dayKey);
      }
    } catch (e) {
      setError(t("today_submit_error"));
      console.error(e);
    } finally {
      if (!delaySubmitSuccessRef.current) setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <p style={{ color: COLORS.TEXT_PRIMARY }}>{t("loading_question_today")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <p style={{ color: COLORS.TEXT_PRIMARY }}>{error}</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <p style={{ color: COLORS.TEXT_PRIMARY }}>{t("today_no_question")}</p>
      </div>
    );
  }

  const primaryButtonStyle: React.CSSProperties = {
    height: 54,
    padding: "0 2.5rem",
    borderRadius: 9999,
    border: "none",
    background: `linear-gradient(to right, ${COLORS.ACCENT_LIGHT}, ${COLORS.ACCENT})`,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: "0.2px",
    cursor: "pointer",
    transition: "transform 150ms ease, box-shadow 150ms ease",
    boxShadow: "0 10px 24px rgba(139,92,246,0.3)",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 16px 2rem",
        height: "100%",
        width: "100%",
        background: "transparent",
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <section style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        {showSubmitSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(244,246,249,0.85)",
              zIndex: 10,
              borderRadius: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.5 }}
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: JOKER.GRADIENT,
                border: JOKER.BORDER,
                boxShadow: JOKER.SHADOW,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={36} strokeWidth={2.5} color="#FFFFFF" />
            </motion.div>
          </motion.div>
        )}
        {answer && !isEditMode ? (
          <motion.div
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "clamp(2rem, 10vh, 5rem) 0",
            }}
          >
            <div
              style={{
                width: "100%",
                marginBottom: 48,
                paddingLeft: 4,
                paddingRight: 4,
              }}
            >
              <div
                style={{
                  position: "relative",
                  background: "rgba(255,255,255,0.5)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  borderRadius: 28,
                  padding: "1.5px",
                  border: "1px solid rgba(139, 92, 246, 0.15)",
                  boxShadow: "0 12px 40px rgba(139, 92, 246, 0.08), 0 0 0 1px rgba(139, 92, 246, 0.05)",
                }}
              >
                <div
                  style={{
                    background: "linear-gradient(to bottom right, rgba(255,255,255,0.8), rgba(255,255,255,0.6))",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    borderRadius: 27,
                    padding: "48px 16px",
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    minHeight: 140,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 48,
                      height: 48,
                      background: "linear-gradient(to bottom right, rgba(139,92,246,0.08), transparent)",
                      borderBottomRightRadius: 999,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 48,
                      height: 48,
                      background: "linear-gradient(to top left, rgba(139,92,246,0.08), transparent)",
                      borderTopLeftRadius: 999,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 20,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "rgba(139,92,246,0.3)",
                    }}
                  >
                    {formattedQuestionNumber}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.85rem" }}>
                    <div
                      style={{
                        width: 51,
                        height: 51,
                        borderRadius: "50%",
                        background: JOKER.GRADIENT,
                        border: JOKER.BORDER,
                        boxShadow: JOKER.SHADOW,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={24} strokeWidth={2.5} color="#FFFFFF" />
                    </div>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 22,
                      fontWeight: 500,
                      color: "#374151",
                      textAlign: "center",
                      lineHeight: 1.5,
                      letterSpacing: "-0.01em",
                      position: "relative",
                      zIndex: 10,
                    }}
                  >
                    {question.text}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditMode(true);
                setDraft(answer.answer_text);
              }}
              style={{
                padding: "0.65rem 1.35rem",
                borderRadius: 9999,
                border: "none",
                background: `linear-gradient(to right, ${COLORS.ACCENT_LIGHT}, ${COLORS.ACCENT})`,
                boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.2px",
                cursor: "pointer",
              }}
            >
              {t("today_edit_answer")}
            </button>
            {process.env.NODE_ENV === "development" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={clearTodayAnswerForDev}
                  style={{
                    padding: "0.35rem 0.75rem",
                    fontSize: "0.75rem",
                    color: COLORS.TEXT_PRIMARY,
                    background: "transparent",
                    border: "1px dashed rgba(156,163,175,0.6)",
                    borderRadius: "999px",
                    cursor: "pointer",
                    opacity: 0.8,
                  }}
                >
                  Clear today's answer
                </button>
                {onShowRecapTest && (
                  <button
                    type="button"
                    onClick={onShowRecapTest}
                    style={{
                      padding: "0.35rem 0.75rem",
                      fontSize: "0.75rem",
                      color: COLORS.TEXT_PRIMARY,
                      background: "transparent",
                      border: `1px dashed ${COLORS.TEXT_TERTIARY}`,
                      borderRadius: "999px",
                      cursor: "pointer",
                      opacity: 0.7,
                    }}
                  >
                    Show Monday Recap
                  </button>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "stretch",
              padding: "1rem 0",
            }}
          >
            <div
              style={{
                width: "100%",
                marginBottom: 48,
                paddingLeft: 4,
                paddingRight: 4,
              }}
            >
              <div
                style={{
                  position: "relative",
                  background: "rgba(255,255,255,0.5)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  borderRadius: 28,
                  padding: "1.5px",
                  border: "1px solid rgba(139, 92, 246, 0.15)",
                  boxShadow: "0 12px 40px rgba(139, 92, 246, 0.08), 0 0 0 1px rgba(139, 92, 246, 0.05)",
                }}
              >
                <div
                  style={{
                    background: "linear-gradient(to bottom right, rgba(255,255,255,0.8), rgba(255,255,255,0.6))",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    borderRadius: 27,
                    padding: "48px 16px",
                    position: "relative",
                    overflow: "hidden",
                    minHeight: 140,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: 48,
                      height: 48,
                      background: "linear-gradient(to bottom right, rgba(139,92,246,0.08), transparent)",
                      borderBottomRightRadius: 999,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 48,
                      height: 48,
                      background: "linear-gradient(to top left, rgba(139,92,246,0.08), transparent)",
                      borderTopLeftRadius: 999,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 20,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: "rgba(139,92,246,0.3)",
                    }}
                  >
                    {formattedQuestionNumber}
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 22,
                      fontWeight: 500,
                      color: "#374151",
                      textAlign: "center",
                      lineHeight: 1.5,
                      letterSpacing: "-0.01em",
                      position: "relative",
                      zIndex: 10,
                    }}
                  >
                    {question.text}
                  </p>
                </div>
              </div>
            </div>
            {!(showAnswerInput || isEditMode) ? (
              <div
                style={{
                  width: "100%",
                  paddingLeft: 4,
                  paddingRight: 4,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowAnswerInput(true)}
                  style={{
                    ...primaryButtonStyle,
                    width: "100%",
                    marginTop: 0,
                    padding: "0.65rem 1.35rem",
                    fontSize: 14,
                    height: "auto",
                  }}
                >
                  {t("today_answer_question")}
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("today_placeholder")}
                  style={{
                    minHeight: "9rem",
                    padding: "1.25rem 1.5rem",
                    borderRadius: 24,
                    border: "1px solid rgba(255,255,255,0.6)",
                    background: "rgba(255,254,249,0.75)",
                    backdropFilter: "blur(24px)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9)",
                    resize: "vertical",
                    fontFamily: "inherit",
                    fontSize: 16,
                    lineHeight: 1.45,
                    color: COLORS.TEXT_PRIMARY,
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(196,181,253,0.5)";
                    e.target.style.outline = "none";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(255,255,255,0.6)";
                  }}
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  style={{ ...primaryButtonStyle, marginTop: "1.5rem" }}
                  disabled={submitting}
                >
                  {answer ? t("today_update") : t("today_submit")}
                </button>
              </>
            )}
            {process.env.NODE_ENV === "development" && onShowRecapTest && (
              <button
                type="button"
                onClick={onShowRecapTest}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.75rem",
                  color: COLORS.TEXT_PRIMARY,
                  background: "transparent",
                  border: `1px dashed ${COLORS.TEXT_TERTIARY}`,
                  borderRadius: "999px",
                  cursor: "pointer",
                  opacity: 0.7,
                }}
              >
                Show Monday Recap
              </button>
            )}
          </div>
        )}
        {offline && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: COLORS.TEXT_SECONDARY }}>
            Je bent offline. Je antwoord wordt gesynchroniseerd zodra je weer online bent.
          </p>
        )}
      </section>

      {showEditConfirmation &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ ...MODAL.WRAPPER, pointerEvents: "auto" }} onClick={closeEditConfirmation}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: editConfirmationClosing ? 0 : 1 }}
              transition={{ duration: 0.2 }}
              style={MODAL.BACKDROP}
              aria-hidden
            />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: editConfirmationClosing ? 0.5 : 1, opacity: editConfirmationClosing ? 0 : 1 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.5 }}
              style={{
                position: "relative",
                zIndex: 1,
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: JOKER.GRADIENT,
                border: JOKER.BORDER,
                boxShadow: JOKER.SHADOW,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <Check size={36} strokeWidth={2.5} color="#FFFFFF" />
            </motion.div>
          </div>,
          modalContainerRef?.current ?? document.body
        )}
    </div>
  );
}

// ============ MISSED DAY ANSWER MODAL (Calendar overlay) ============
function MissedDayAnswerModal({
  dayKey,
  user,
  onClose,
  onSuccess,
}: {
  dayKey: string;
  user: any;
  onClose: () => void;
  onSuccess: (dayKey: string, questionText: string, answerText: string) => void;
}) {
  const { t, lang } = useLanguage();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => onClose(), MODAL_CLOSE_MS);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (process.env.NODE_ENV === "development" && user?.id === "dev-user") {
          if (!cancelled) {
            setQuestion({
              id: "dev-question-id",
              text: "Vraag van die dag",
              day: dayKey,
            });
          }
          setLoading(false);
          return;
        }
        const supabase = createSupabaseBrowserClient();
        const tableName = lang === 'en' ? 'daily_questions_en' : 'questions';
        let data: { id: string; text?: string; day?: string; question_text?: string; question_date?: string } | null;
        let fetchError: any;
        if (tableName === 'daily_questions_en') {
          const res = await supabase
            .from(tableName)
            .select('id, question_text, question_date')
            .eq('question_date', dayKey)
            .maybeSingle();
          data = res.data;
          fetchError = res.error;
        } else {
          const res = await supabase
            .from(tableName)
            .select('id, text, day')
            .eq('day', dayKey)
            .maybeSingle();
          data = res.data;
          fetchError = res.error;
        }
        if (cancelled) return;
        if (fetchError) {
          setError("missed_answer_error_load");
          setLoading(false);
          return;
        }
        let normalizedQuestion: Question | null = null;
        if (data) {
          if (tableName === 'daily_questions_en') {
            normalizedQuestion = {
              id: data.id,
              text: data.question_text ?? '',
              day: data.question_date ?? ''
            };
          } else {
            normalizedQuestion = {
              id: data.id,
              text: data.text ?? '',
              day: data.day ?? ''
            };
          }
        }
        if (normalizedQuestion) {
          setQuestion(normalizedQuestion);
        } else {
          setError("missed_answer_error_none");
        }
      } catch (e) {
        if (!cancelled) setError("missed_answer_error_generic");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [dayKey, user?.id]);

  const handleSubmit = async () => {
    if (!question || !draft.trim() || submitting) return;
    const dayKeyAsDate = new Date(dayKey + "T12:00:00");
    if (isBeforeAccountStart(dayKeyAsDate, user)) {
      setSubmitError("missed_answer_error_before_account");
      return;
    }
    if (!canAnswerDate(dayKeyAsDate)) {
      setSubmitError("missed_answer_error_outside_window");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (process.env.NODE_ENV === "development" && user?.id === "dev-user") {
        try {
          localStorage.setItem(`dev-answer-${dayKey}`, draft);
        } catch (_) {}
        setIsClosing(true);
        setTimeout(() => {
          onSuccess(dayKey, question.text, draft);
          onClose();
        }, MODAL_CLOSE_MS);
        setSubmitting(false);
        return;
      }
      const supabase = createSupabaseBrowserClient();
      await saveAnswer({
        supabase,
        userId: user.id,
        draft,
        dayKey,
        questionText: question.text,
        setAnswer: () => {},
        onCalendarUpdate: null,
        userCreatedAt: user.created_at,
      });
      setIsClosing(true);
      setTimeout(() => {
        onSuccess(dayKey, question.text, draft);
        onClose();
      }, MODAL_CLOSE_MS);
    } catch (e: any) {
      setSubmitError("missed_answer_error_save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ ...MODAL.WRAPPER, pointerEvents: "auto" }} onClick={handleClose}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isClosing ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        style={MODAL.BACKDROP}
        onClick={handleClose}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: isClosing ? 0 : 1, scale: isClosing ? 0.9 : 1, y: isClosing ? 20 : 0 }}
        transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
        style={{ ...MODAL.CARD_WIDE, maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label={t("common_close")} onClick={handleClose} style={MODAL.CLOSE_BUTTON}>
          <X size={16} strokeWidth={2.5} />
        </button>

        {loading && (
          <p style={{ color: COLORS.TEXT_SECONDARY, padding: "2rem 0" }}>{t("loading_question")}</p>
        )}
        {error && !loading && (
          <div style={{ padding: "1rem 0" }}>
            <p style={{ color: COLORS.TEXT_PRIMARY, marginBottom: "1rem" }}>{t(error)}</p>
            <button
              type="button"
              onClick={handleClose}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: 999,
                border: "none",
                background: COLORS.ACCENT,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("common_close")}
            </button>
          </div>
        )}
        {question && !loading && (
          <div style={{ paddingTop: "2rem" }}>
            <p
              style={{
                fontSize: "0.875rem",
                color: COLORS.TEXT_SECONDARY,
                marginBottom: "0.5rem",
              }}
            >
              {t("missed_answer_question_label")}
            </p>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: COLORS.TEXT_PRIMARY }}>
              {question.text}
            </h3>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("today_placeholder")}
              style={{
                width: "100%",
                minHeight: "8rem",
                padding: "1rem",
                borderRadius: 16,
                border: "1px solid rgba(28,28,30,0.2)",
                background: GLASS.BG,
                fontSize: 16,
                lineHeight: 1.45,
                color: COLORS.TEXT_PRIMARY,
                fontFamily: "inherit",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            {submitError && (
              <p style={{ color: COLORS.TEXT_PRIMARY, fontSize: "0.875rem", marginTop: "0.5rem" }}>
                {t(submitError)}
              </p>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !draft.trim()}
              style={{
                marginTop: "1rem",
                width: "100%",
                height: 54,
                padding: "0 1.5rem",
                borderRadius: 9999,
                border: "none",
                background: `linear-gradient(to right, ${COLORS.ACCENT_LIGHT}, ${COLORS.ACCENT})`,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.2px",
                cursor: submitting ? "default" : "pointer",
                opacity: submitting || !draft.trim() ? 0.6 : 1,
                boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
              }}
            >
              {submitting ? t("missed_answer_submitting") : t("today_submit")}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ============ CALENDAR VIEW ============
function CalendarView({
  answersMap,
  setAnswersMap,
  user,
  profile,
  onProfileRefetch,
  onAnswerMissedDay,
  modalContainerRef,
}: {
  answersMap: Map<string, { questionText: string; answerText: string }>;
  setAnswersMap: React.Dispatch<React.SetStateAction<Map<string, { questionText: string; answerText: string }>>>;
  user: any;
  profile: { id: string; joker_balance: number; last_joker_grant_month: string | null } | null;
  onProfileRefetch: () => Promise<void>;
  onAnswerMissedDay?: (dayKey: string) => void;
  modalContainerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { t, lang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayYear, setDisplayYear] = useState(() => getNow().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(() => getNow().getMonth());
  const [selectedDay, setSelectedDay] = useState<{
    day: string;
    questionText: string;
    answerText: string;
  } | null>(null);
  const [closingModal, setClosingModal] = useState(false);
  const [missedDayModal, setMissedDayModal] = useState<"missed_has_joker" | "missed_no_joker" | "closed" | null>(null);
  const [missedDayKey, setMissedDayKey] = useState<string | null>(null);
  const [selectedDateForAnswer, setSelectedDateForAnswer] = useState<string | null>(null);
  const [closingMissedModal, setClosingMissedModal] = useState(false);
  const [useJokerLoading, setUseJokerLoading] = useState(false);
  const [useJokerError, setUseJokerError] = useState<string | null>(null);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const calendarInitialLoadDoneRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      calendarInitialLoadDoneRef.current = false;
      return;
    }

    const fetchAnswers = async () => {
      const isInitialLoad = !calendarInitialLoadDoneRef.current;
      if (isInitialLoad) setLoading(true);
      setError(null);
      try {
        // In development with mock user, show empty calendar
        if (process.env.NODE_ENV === 'development' && user.id === 'dev-user') {
          console.log('📅 Dev mode: Showing calendar with one seed completed day');
          const yesterday = new Date(getNow());
          yesterday.setDate(yesterday.getDate() - 1);
          const seedKey = getLocalDayKey(yesterday);
          setAnswersMap(
            new Map([
              [
                seedKey,
                {
                  questionText: "Waar heb je gisteren om gelachen?",
                  answerText: "Een voorbeeldantwoord om de voltooide dag-styling te bekijken.",
                },
              ],
            ])
          );
          calendarInitialLoadDoneRef.current = true;
          setLoading(false);
          return;
        }

        const supabase = createSupabaseBrowserClient();
        const startOfMonth = new Date(displayYear, displayMonth, 1);
        const endOfMonth = new Date(displayYear, displayMonth + 1, 0);
        const startStr = startOfMonth.toISOString().slice(0, 10);
        const endStr = endOfMonth.toISOString().slice(0, 10);

        const { data: answersData, error: answersError } = await supabase
          .from("answers")
          .select("answer_text, question_date")
          .eq("user_id", user.id)
          .gte("question_date", startStr)
          .lte("question_date", endStr);

        if (answersError) throw answersError;

        const questionTable = lang === "en" ? "daily_questions_en" : "questions";
        const questionDateCol = lang === "en" ? "question_date" : "day";
        const questionTextCol = lang === "en" ? "question_text" : "text";
        const { data: questionsData } = await supabase
          .from(questionTable)
          .select(`${questionDateCol}, ${questionTextCol}`)
          .gte(questionDateCol, startStr)
          .lte(questionDateCol, endStr);

        const dayToText = new Map<string, string>();
        if (questionsData) {
          for (const row of questionsData as { question_date?: string; day?: string; question_text?: string; text?: string }[]) {
            const day = questionDateCol === "question_date" ? row.question_date : row.day;
            const text = questionTextCol === "question_text" ? row.question_text : row.text;
            if (day) dayToText.set(day, text ?? "");
          }
        }

        const map = new Map<
          string,
          { questionText: string; answerText: string }
        >();
        if (answersData) {
          for (const row of answersData) {
            if (row.question_date) {
              map.set(row.question_date, {
                questionText: dayToText.get(row.question_date) ?? "",
                answerText: row.answer_text ?? "",
              });
            }
          }
        }
        setAnswersMap((prev) => {
          const merged = new Map(prev);
          for (const [k, v] of map) merged.set(k, v);
          return merged;
        });
        calendarInitialLoadDoneRef.current = true;
      } catch (e) {
        setError("calendar_error_load");
        console.error(e);
      } finally {
        if (isInitialLoad) setLoading(false);
      }
    };

    void fetchAnswers();
  }, [user, displayYear, displayMonth]);

  if (!user) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <p style={{ color: COLORS.TEXT_PRIMARY }}>{t("calendar_login_prompt")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <p style={{ color: COLORS.TEXT_PRIMARY }}>{t("loading_calendar")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        <p style={{ color: COLORS.TEXT_PRIMARY }}>{error}</p>
      </div>
    );
  }

  const monthNames = [
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ];

  const prevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const nextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  // Week starts Monday: 0 = Monday, 6 = Sunday
  const firstDay = (new Date(displayYear, displayMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const todayKey = getLocalDayKey(getNow());

  let answerableDaysThisMonth = 0;
  let capturedThisMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(displayYear, displayMonth, d);
    if (isBeforeAccountStart(dayDate, user)) continue;
    answerableDaysThisMonth++;
    const dk = getLocalDayKey(dayDate);
    if (answersMap.has(dk)) capturedThisMonth++;
  }

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

  // Streak: consecutive days with answers ending at today
  let streakCount = 0;
  const today = getNow();
  for (let offset = 0; offset < 365; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    const key = getLocalDayKey(d);
    if (isBeforeAccountStart(d, user)) break;
    if (!answersMap.has(key)) break;
    streakCount++;
  }

  const dowLabels = lang === "nl" ? ["ma", "di", "wo", "do", "vr", "za", "zo"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleDayTap = (day: number) => {
    const dayDate = new Date(displayYear, displayMonth, day);
    const dayKey = getLocalDayKey(dayDate);
    if (isBeforeAccountStart(dayDate, user)) return;
    const entry = answersMap.get(dayKey);
    if (entry) {
      setSelectedDay({
        day: dayKey,
        questionText: entry.questionText,
        answerText: entry.answerText,
      });
      return;
    }
    if (isMissedDay(dayDate, user, false)) {
      setMissedDayKey(dayKey);
      if (!canAnswerDate(dayDate)) {
        setMissedDayModal("closed");
      } else {
        setMissedDayModal((profile?.joker_balance ?? 0) > 0 ? "missed_has_joker" : "missed_no_joker");
      }
    }
  };

  const handleCloseMissedModal = () => {
    if (closingMissedModal) return;
    setUseJokerError(null);
    setClosingMissedModal(true);
    setTimeout(() => {
      setMissedDayModal(null);
      setMissedDayKey(null);
      setClosingMissedModal(false);
    }, MODAL_CLOSE_MS);
  };

  const handleUseJokerConfirm = async () => {
    if (!missedDayKey || useJokerLoading) return;
    setUseJokerError(null);
    setUseJokerLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc("use_joker");
      if (rpcError) {
        setUseJokerError(t("missed_no_jokers_left_error"));
        setUseJokerLoading(false);
        return;
      }
      if (data === true) {
        await onProfileRefetch();
        const keyToOpen = missedDayKey;
        setClosingMissedModal(true);
        setTimeout(() => {
          setMissedDayModal(null);
          setMissedDayKey(null);
          setClosingMissedModal(false);
          setUseJokerLoading(false);
          requestAnimationFrame(() => setSelectedDateForAnswer(keyToOpen));
        }, MODAL_CLOSE_MS);
      } else {
        setUseJokerError(t("missed_no_jokers_left_error"));
        setUseJokerLoading(false);
      }
    } catch {
      setUseJokerError(t("missed_no_jokers_left_error"));
      setUseJokerLoading(false);
    }
  };

  const handleCloseModal = () => {
    setClosingModal(true);
    setTimeout(() => {
      setSelectedDay(null);
      setClosingModal(false);
    }, MODAL_CLOSE_MS);
  };

  const goToToday = () => {
    const now = getNow();
    setDisplayYear(now.getFullYear());
    setDisplayMonth(now.getMonth());
  };

  const now = getNow();
  const yearOptions = (() => {
    const start = 2020;
    const end = now.getFullYear() + 2;
    const arr: number[] = [];
    for (let y = end; y >= start; y--) arr.push(y);
    return arr;
  })();

  const isViewingCurrentMonth = displayYear === now.getFullYear() && displayMonth === now.getMonth();

  const yearButtonStyle = {
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "none",
    background: "#FFFFFF",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    cursor: "pointer" as const,
    fontSize: "1.125rem",
    color: "#3F3F46",
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  return (
    <div 
      style={{ 
        height: "100%",
        width: "100%",
        padding: "0.5rem 24px 1.5rem",
        position: "relative",
        overflowY: "auto",
        overflowX: "hidden",
        boxSizing: "border-box",
        background: "transparent",
      }}
    >
      {/* Year above month: tap to open year picker */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
        <button
          type="button"
          onClick={() => setShowYearPicker(true)}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            background: "transparent",
            cursor: "pointer",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#71717A",
          }}
          aria-label={t("calendar_select_year")}
        >
          {displayYear}
        </button>
      </div>

      {/* Month nav: month on top, Today underneath */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
          <button type="button" onClick={prevMonth} style={yearButtonStyle} aria-label={t("calendar_prev")}>
            ‹
          </button>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#18181B", margin: 0 }}>
            {monthNames[displayMonth]}
          </h2>
          <button type="button" onClick={nextMonth} style={yearButtonStyle} aria-label={t("calendar_next")}>
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={goToToday}
          style={{
            padding: "4px 10px",
            borderRadius: 8,
            background: "transparent",
            cursor: "pointer",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: isViewingCurrentMonth ? "#8B5CF6" : "#71717A",
          }}
        >
          {t("calendar_today")}
        </button>
      </div>

      <div
        style={{
          borderRadius: 24,
          background: "rgba(255,254,249,0.75)",
          backdropFilter: GLASS.BLUR,
          WebkitBackdropFilter: GLASS.BLUR,
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.6)",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 8,
            minWidth: 0,
            boxSizing: "border-box",
            marginBottom: 16,
          }}
        >
          {dowLabels.map((dow) => (
            <div
              key={dow}
              style={{
                textAlign: "center",
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.TEXT_SECONDARY,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {dow}
            </div>
          ))}
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} />;
            }
            const dayDate = new Date(displayYear, displayMonth, day);
            const dayKey = getLocalDayKey(dayDate);
            const hasAnswer = answersMap.has(dayKey);
            const isToday = dayKey === todayKey;
            const isFuture = dayKey > todayKey;
            const isTooOld = !canAnswerDate(dayDate);
            const beforeStart = isBeforeAccountStart(dayDate, user);
            const isMissed = isMissedDay(dayDate, user, hasAnswer);
            const tappable = !beforeStart && (hasAnswer || isMissed);

            return (
              <button
                key={day}
                type="button"
                onClick={() => tappable && handleDayTap(day)}
                style={{
                  ...getCalendarStyle({
                    hasAnswer,
                    isToday,
                    isFuture,
                    isTooOld,
                    isBeforeAccountStart: beforeStart,
                  }),
                  cursor: tappable ? "pointer" : "default",
                  padding: 0,
                  minWidth: 0,
                  border: "none",
                  fontFamily: "inherit",
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                }}
              >
                {day}
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 32,
            paddingTop: 24,
            borderTop: "1px solid rgba(229,231,235,0.4)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.125rem", fontWeight: 600, color: COLORS.HEADER_Q }}>{capturedThisMonth}</span>
            <span style={{ fontSize: 14, color: COLORS.TEXT_SECONDARY }}>
              {lang === "nl" ? "van de" : "out of"} {answerableDaysThisMonth} {lang === "nl" ? "dagen beantwoord" : "days answered"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.125rem", fontWeight: 600, color: COLORS.ACCENT }}>{streakCount}</span>
            <span style={{ fontSize: 14, color: COLORS.TEXT_SECONDARY }}>{lang === "nl" ? "dagen streak" : "day streak"}</span>
          </div>
        </div>
      </div>

      {showYearPicker &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ ...MODAL.WRAPPER, pointerEvents: "auto" }} onClick={() => setShowYearPicker(false)}>
            <div style={MODAL.BACKDROP} aria-hidden />
            <div
              style={{
                ...MODAL.CARD,
                maxHeight: "70vh",
                overflow: "auto",
                textAlign: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label={t("common_close")}
                onClick={() => setShowYearPicker(false)}
                style={MODAL.CLOSE_BUTTON}
              >
                <X size={16} strokeWidth={2.5} />
              </button>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 1rem", color: COLORS.TEXT_PRIMARY }}>
                {t("calendar_select_year_title")}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: "50vh", overflowY: "auto" }}>
                {yearOptions.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setDisplayYear(y);
                      setShowYearPicker(false);
                    }}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      border: displayYear === y ? `2px solid ${COLORS.ACCENT}` : "1px solid rgba(229,231,235,0.6)",
                      background: displayYear === y ? "rgba(139,92,246,0.1)" : "transparent",
                      color: COLORS.TEXT_PRIMARY,
                      fontSize: 16,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          </div>,
          modalContainerRef?.current ?? document.body
        )}

      {selectedDay &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ ...MODAL.WRAPPER, pointerEvents: "auto" }} onClick={handleCloseModal}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: closingModal ? 0 : 1 }}
              transition={{ duration: 0.2 }}
              style={MODAL.BACKDROP}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{
                opacity: closingModal ? 0 : 1,
                scale: closingModal ? 0.9 : 1,
                y: closingModal ? 20 : 0,
              }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              style={{ ...MODAL.CARD_WIDE, maxHeight: "75%", overflow: "auto", textAlign: "center" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" aria-label={t("common_close")} onClick={handleCloseModal} style={{ ...MODAL.CLOSE_BUTTON, zIndex: 1 }}>
                <X size={16} strokeWidth={2.5} />
              </button>
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 9999, background: "rgba(237,233,254,0.8)", marginBottom: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ACCENT }}>
                    {(() => {
                      const [y, m, d] = selectedDay.day.split("-").map(Number);
                      return new Intl.DateTimeFormat(lang === "nl" ? "nl-NL" : "en-US", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(y, m - 1, d));
                    })()}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem", color: COLORS.TEXT_PRIMARY, lineHeight: 1.4 }}>
                  {selectedDay.questionText}
                </h3>
              </div>
              <div style={{ background: "rgba(255,254,249,0.7)", borderRadius: 20, padding: 20, border: "1px solid rgba(229,231,235,0.4)", textAlign: "center" }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: COLORS.TEXT_SECONDARY, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                  {t("calendar_your_answer")}
                </h4>
                <p style={{ fontSize: 16, lineHeight: 1.45, margin: 0, color: COLORS.TEXT_PRIMARY }}>
                  {selectedDay.answerText}
                </p>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    height: 54,
                    padding: "0 1.5rem",
                    borderRadius: 9999,
                    border: "none",
                    background: `linear-gradient(to right, ${COLORS.ACCENT_LIGHT}, ${COLORS.ACCENT})`,
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: "0.2px",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
                  }}
                >
                  {t("calendar_view_answer_close")}
                </button>
              </div>
            </motion.div>
          </div>,
          modalContainerRef?.current ?? document.body
        )}

      {missedDayModal === "missed_has_joker" &&
        missedDayKey &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ ...MODAL.WRAPPER, pointerEvents: "auto" }} onClick={handleCloseMissedModal}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: closingMissedModal ? 0 : 1 }}
              transition={{ duration: 0.2 }}
              style={MODAL.BACKDROP}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: closingMissedModal ? 0 : 1, scale: closingMissedModal ? 0.9 : 1, y: closingMissedModal ? 20 : 0 }}
              transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
              style={{ ...MODAL.CARD, textAlign: "center" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" aria-label={t("common_close")} onClick={handleCloseMissedModal} style={MODAL.CLOSE_BUTTON}>
                <X size={16} strokeWidth={2.5} />
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem", marginTop: 0 }}>
                {(t("missed_use_joker_message").split(/\n\n+/).filter(Boolean).map((paragraph, i) => (
                  <p key={i} style={{ fontSize: "1.125rem", lineHeight: 1.5, margin: 0, color: COLORS.TEXT_PRIMARY, fontWeight: 500 }}>
                    {paragraph}
                  </p>
                )))}
              </div>
              {useJokerError && (
                <p style={{ fontSize: 14, color: COLORS.ACCENT, marginBottom: "0.75rem" }}>{useJokerError}</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleUseJokerConfirm}
                  disabled={useJokerLoading}
                  style={{
                    height: 54,
                    padding: "0 1.5rem",
                    borderRadius: 9999,
                    border: JOKER.BORDER,
                    background: JOKER.GRADIENT,
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: "0.2px",
                    cursor: useJokerLoading ? "not-allowed" : "pointer",
                    opacity: useJokerLoading ? 0.7 : 1,
                    boxShadow: JOKER.SHADOW,
                    textShadow: "0 1px 2px rgba(0,0,0,0.25)",
                  }}
                >
                  {useJokerLoading ? t("loading") : t("missed_use_joker_btn")}
                </button>
                <button
                  type="button"
                  onClick={handleCloseMissedModal}
                  disabled={useJokerLoading}
                  style={{ padding: "0.75rem", fontSize: 16, border: "none", background: "transparent", color: COLORS.TEXT_SECONDARY, cursor: "pointer" }}
                >
                  {t("common_cancel")}
                </button>
              </div>
            </motion.div>
          </div>,
          modalContainerRef?.current ?? document.body
        )}

      {missedDayModal === "missed_no_joker" &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ ...MODAL.WRAPPER, pointerEvents: "auto" }} onClick={handleCloseMissedModal}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: closingMissedModal ? 0 : 1 }} transition={{ duration: 0.2 }} style={MODAL.BACKDROP} aria-hidden />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: closingMissedModal ? 0 : 1, scale: closingMissedModal ? 0.9 : 1, y: closingMissedModal ? 20 : 0 }} transition={{ type: "spring", bounce: 0.3, duration: 0.4 }} style={{ ...MODAL.CARD, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label={t("common_close")} onClick={handleCloseMissedModal} style={MODAL.CLOSE_BUTTON}>
                <X size={16} strokeWidth={2.5} />
              </button>
              <h3 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: COLORS.TEXT_PRIMARY }}>{t("missed_title")}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.45, marginBottom: "1.5rem", color: COLORS.TEXT_SECONDARY }}>{t("missed_no_jokers_body")}</p>
              <button type="button" onClick={handleCloseMissedModal} style={{ height: 54, padding: "0 1.5rem", borderRadius: 9999, border: "none", background: `linear-gradient(to right, ${COLORS.ACCENT_LIGHT}, ${COLORS.ACCENT})`, color: "#FFFFFF", fontSize: 16, fontWeight: 600, letterSpacing: "0.2px", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>{t("common_ok")}</button>
            </motion.div>
          </div>,
          modalContainerRef?.current ?? document.body
        )}

      {missedDayModal === "closed" &&
        typeof document !== "undefined" &&
        createPortal(
          <div style={{ ...MODAL.WRAPPER, pointerEvents: "auto" }} onClick={handleCloseMissedModal}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: closingMissedModal ? 0 : 1 }} transition={{ duration: 0.2 }} style={MODAL.BACKDROP} aria-hidden />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: closingMissedModal ? 0 : 1, scale: closingMissedModal ? 0.9 : 1, y: closingMissedModal ? 20 : 0 }} transition={{ type: "spring", bounce: 0.3, duration: 0.4 }} style={{ ...MODAL.CARD, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label={t("common_close")} onClick={handleCloseMissedModal} style={MODAL.CLOSE_BUTTON}>
                <X size={16} strokeWidth={2.5} />
              </button>
              <h3 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: COLORS.TEXT_PRIMARY }}>{t("closed_title")}</h3>
              <p style={{ fontSize: 16, lineHeight: 1.45, marginBottom: "1.5rem", color: COLORS.TEXT_SECONDARY }}>{t("closed_body")}</p>
              <button type="button" onClick={handleCloseMissedModal} style={{ height: 54, padding: "0 1.5rem", borderRadius: 9999, border: "none", background: `linear-gradient(to right, ${COLORS.ACCENT_LIGHT}, ${COLORS.ACCENT})`, color: "#FFFFFF", fontSize: 16, fontWeight: 600, letterSpacing: "0.2px", cursor: "pointer", boxShadow: "0 4px 12px rgba(139,92,246,0.3)" }}>{t("common_ok")}</button>
            </motion.div>
          </div>,
          modalContainerRef?.current ?? document.body
        )}

      {selectedDateForAnswer &&
        user &&
        typeof document !== "undefined" &&
        createPortal(
          <MissedDayAnswerModal
            dayKey={selectedDateForAnswer}
            user={user}
            onClose={() => setSelectedDateForAnswer(null)}
            onSuccess={(dayKey, questionText, answerText) => {
              setAnswersMap((prev) => {
                const next = new Map(prev);
                next.set(dayKey, { questionText, answerText });
                return next;
              });
              setSelectedDateForAnswer(null);
            }}
          />,
          modalContainerRef?.current ?? document.body
        )}
    </div>
  );
}

// ============ SETTINGS VIEW ============
function SettingsView({ user, onShowLoadingScreen, onShowOnboardingScreen }: { user: any; onShowLoadingScreen?: () => void; onShowOnboardingScreen?: () => void }) {
  const { t, lang, setLang } = useLanguage();
  const [signingOut, setSigningOut] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      window.location.reload();
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      setSigningOut(false);
    }
  };

  const settingsCardStyle: React.CSSProperties = {
    borderRadius: 20,
    background: "rgba(255,254,249,0.65)",
    backdropFilter: GLASS.BLUR,
    WebkitBackdropFilter: GLASS.BLUR,
    border: "1px solid rgba(255,255,255,0.5)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.6)",
    padding: "12px 16px",
    marginBottom: 10,
  };

  return (
    <div
      style={{
        padding: "24px",
        width: "100%",
        minHeight: "100%",
        boxSizing: "border-box",
        background: "transparent",
      }}
    >
      <h2 style={{ fontSize: "1.875rem", fontWeight: 600, marginBottom: "2rem", color: COLORS.TEXT_PRIMARY }}>{t("settings_title")}</h2>

      <div style={{ ...settingsCardStyle, opacity: 0.5, pointerEvents: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(237,233,254,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={16} strokeWidth={2} color={COLORS.ACCENT} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.TEXT_PRIMARY, marginBottom: 1 }}>{t("settings_reminder")}</div>
              <div style={{ fontSize: 13, color: COLORS.TEXT_SECONDARY }}>{t("settings_reminder_time")}</div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowLanguageModal(true)}
        style={{ ...settingsCardStyle, width: "100%", textAlign: "left", cursor: "pointer", border: "none", fontFamily: "inherit" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(219,234,254,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={16} strokeWidth={2} color="#3B82F6" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.TEXT_PRIMARY, marginBottom: 1 }}>{t("settings_language")}</div>
              <div style={{ fontSize: 13, color: COLORS.TEXT_SECONDARY }}>{lang === "en" ? t("settings_lang_en") : t("settings_lang_nl")}</div>
            </div>
          </div>
        </div>
      </button>

      <a
        href="https://www.instagram.com/thedailyq.app/?hl=en"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Follow DailyQ on Instagram"
        style={{ ...settingsCardStyle, width: "100%", textAlign: "left", cursor: "pointer", border: "none", fontFamily: "inherit", textDecoration: "none", color: "inherit", display: "block" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(253,224,239,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Instagram size={16} strokeWidth={1.5} color="#E4405F" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.TEXT_PRIMARY }}>Follow DailyQ on Instagram</div>
        </div>
      </a>

      {showLanguageModal && typeof document !== "undefined" && createPortal(
        <div style={{ ...MODAL.WRAPPER, pointerEvents: "auto" }} onClick={() => setShowLanguageModal(false)}>
          <div style={MODAL.BACKDROP} aria-hidden />
          <div style={{ ...MODAL.CARD, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <button type="button" aria-label={t("common_close")} onClick={() => setShowLanguageModal(false)} style={MODAL.CLOSE_BUTTON}>
              <X size={16} strokeWidth={2.5} />
            </button>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: "0 0 1rem", color: COLORS.TEXT_PRIMARY }}>{t("settings_language")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={() => { setLang("en"); setShowLanguageModal(false); }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: lang === "en" ? `2px solid ${COLORS.ACCENT}` : GLASS.BORDER,
                  background: lang === "en" ? "rgba(139,92,246,0.08)" : GLASS.BG,
                  color: COLORS.TEXT_PRIMARY,
                  fontSize: 15,
                  fontWeight: lang === "en" ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {t("settings_lang_en")}
              </button>
              <button
                type="button"
                onClick={() => { setLang("nl"); setShowLanguageModal(false); }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: lang === "nl" ? `2px solid ${COLORS.ACCENT}` : GLASS.BORDER,
                  background: lang === "nl" ? "rgba(139,92,246,0.08)" : GLASS.BG,
                  color: COLORS.TEXT_PRIMARY,
                  fontSize: 15,
                  fontWeight: lang === "nl" ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {t("settings_lang_nl")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div style={{ height: 24 }} />

      <div style={settingsCardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(224,231,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Info size={16} strokeWidth={2} color="#6366F1" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.TEXT_PRIMARY, marginBottom: 1 }}>{t("settings_about")}</div>
            <div style={{ fontSize: 13, color: COLORS.TEXT_SECONDARY }}>{t("settings_version")}</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        style={{ ...settingsCardStyle, width: "100%", textAlign: "left", cursor: signingOut ? "wait" : "pointer", border: "none", fontFamily: "inherit", marginTop: 0 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(254,226,226,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={16} strokeWidth={2} color="#DC2626" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.TEXT_PRIMARY, marginBottom: 1 }}>
              {signingOut ? t("settings_signing_out") : t("settings_sign_out")}
            </div>
          </div>
        </div>
      </button>

      {user && user.email && (
        <p style={{ fontSize: 14, color: COLORS.TEXT_SECONDARY, marginTop: 16, marginBottom: 8 }}>
          {t("settings_signed_in_as")} {user.email}
        </p>
      )}

      {onShowLoadingScreen && (
        <button
          type="button"
          onClick={onShowLoadingScreen}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            fontSize: "0.8rem",
            color: COLORS.TEXT_SECONDARY,
            background: "transparent",
            border: "1px dashed rgba(156,163,175,0.5)",
            borderRadius: 999,
            cursor: "pointer",
          }}
        >
          Show loading screen
        </button>
      )}
      {onShowOnboardingScreen && (
        <button
          type="button"
          onClick={onShowOnboardingScreen}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            fontSize: "0.8rem",
            color: COLORS.TEXT_SECONDARY,
            background: "transparent",
            border: "1px dashed rgba(156,163,175,0.5)",
            borderRadius: 999,
            cursor: "pointer",
          }}
        >
          Show onboarding screen
        </button>
      )}

    </div>
  );
}

// ============ UTILITIES ============
function getLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

declare global {
  // eslint-disable-next-line no-var
  var __FORCE_MONDAY__: boolean | undefined;
}

function isMonday(date: Date): boolean {
  if (process.env.NODE_ENV === "development" && globalThis.__FORCE_MONDAY__ === true) {
    return true;
  }
  return date.getDay() === 1;
}

function isBeforeAccountStart(date: Date, user: any): boolean {
  const created = user?.created_at;
  if (!created) return false;
  const createdDate = new Date(created);
  return getLocalDayKey(date) < getLocalDayKey(createdDate);
}

function isMissedDay(date: Date, user: any, hasAnswer: boolean): boolean {
  if (hasAnswer) return false;
  if (isBeforeAccountStart(date, user)) return false;
  const now = getNow();
  return getLocalDayKey(date) < getLocalDayKey(now);
}

function getPreviousWeekRange(today: Date): { start: string; end: string } {
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const lastMonday = new Date(today);
  lastMonday.setDate(lastMonday.getDate() - 7 - daysSinceMonday);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastSunday.getDate() + 6);
  return {
    start: getLocalDayKey(lastMonday),
    end: getLocalDayKey(lastSunday),
  };
}

function getAnswerableDaysInRange(
  startDayKey: string,
  endDayKey: string,
  userCreatedAt: string | undefined
): number {
  const createdKey = userCreatedAt ? getLocalDayKey(new Date(userCreatedAt)) : null;
  let count = 0;
  const start = new Date(startDayKey + "T12:00:00");
  const end = new Date(endDayKey + "T12:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    const dk = getLocalDayKey(cur);
    if (!createdKey || dk >= createdKey) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function canAnswerDate(date: Date): boolean {
  const now = getNow();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 7);
  return getLocalDayKey(date) >= getLocalDayKey(cutoff);
}

function shouldShowMondayRecap(_user: any, today: Date): boolean {
  if (!isMonday(today)) return false;
  const key = "dailyq_recap_" + getLocalDayKey(today);
  return typeof window !== "undefined" && localStorage.getItem(key) !== "1";
}

async function fetchPreviousWeekAnswerCount(userId: string): Promise<number> {
  const supabase = createSupabaseBrowserClient();
  const today = getNow();
  const { start, end } = getPreviousWeekRange(today);
  const { data, error } = await supabase
    .from("answers")
    .select("id")
    .eq("user_id", userId)
    .gte("question_date", start)
    .lte("question_date", end);
  if (error) return 0;
  return (data ?? []).length;
}

async function saveAnswer(params: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  userId: string;
  draft: string;
  dayKey: string;
  questionText: string;
  setAnswer: (a: Answer) => void;
  onCalendarUpdate: ((dayKey: string, questionText: string, answerText: string) => void) | null;
  isEdit?: boolean;
  userCreatedAt?: string;
}) {
  const { supabase, userId, draft, dayKey, questionText, setAnswer, onCalendarUpdate, isEdit, userCreatedAt } =
    params;

  const dayKeyAsDate = new Date(dayKey + "T12:00:00");
  if (userCreatedAt) {
    const createdDate = new Date(userCreatedAt);
    if (getLocalDayKey(dayKeyAsDate) < getLocalDayKey(createdDate)) {
      throw new Error("Cannot submit: this date is before your account start.");
    }
  }
  if (!canAnswerDate(dayKeyAsDate)) {
    throw new Error("Cannot submit: this date is outside the 7-day window.");
  }

  console.log("Saving answer payload:", JSON.stringify({
    user_id: userId,
    question_date: dayKey,
    answer_text: draft,
  }));

  const { data: upserted, error: upsertError } = await supabase
    .from("answers")
    .upsert(
      {
        user_id: userId,
        question_date: dayKey,
        answer_text: draft,
      },
      {
        onConflict: "user_id,question_date",
        ignoreDuplicates: false,
      },
    )
    .select("id, answer_text")
    .single();

  if (upsertError || !upserted) {
    throw upsertError ?? new Error("Could not save answer");
  }

  setAnswer(upserted);
  console.log('📝 Answer saved to database:', { id: upserted.id, textLength: upserted.answer_text?.length });

  if (onCalendarUpdate) {
    onCalendarUpdate(dayKey, questionText, draft);
  }

  if (!isEdit) {
    fireConfetti();
  }
}
