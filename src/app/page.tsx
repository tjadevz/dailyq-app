"use client";
/* eslint-disable no-console */

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getNow } from "@/utils/dateProvider";
import { registerServiceWorker } from "./register-sw";

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

// Design Tokens (Single Source of Truth)
const COLORS = {
  BACKGROUND: "#F4F6F9",
  BACKGROUND_GRADIENT: "linear-gradient(to bottom, #F4F6F9, #EEF2F7)",
  TEXT_PRIMARY: "#1C1C1E",
  TEXT_SECONDARY: "rgba(28,28,30,0.6)",
  TEXT_TERTIARY: "rgba(28,28,30,0.55)",
  TEXT_MUTED: "rgba(28,28,30,0.4)",
  TEXT_FUTURE: "rgba(28,28,30,0.22)",
  ACCENT: "#14316A",
};

const GLASS = {
  BG: "rgba(255,255,255,0.75)",
  STRONG_BG: "rgba(255,255,255,0.85)",
  BORDER: "1px solid rgba(255,255,255,0.4)",
  SHADOW: "0 10px 30px rgba(0,0,0,0.08)",
  TAB_SHADOW: "0 8px 25px rgba(0,0,0,0.08)",
  BLUR: "blur(25px)",
};

const CALENDAR = {
  COMPLETED_BG: "linear-gradient(to bottom, #1C3F85, #14316A)",
  COMPLETED_SHADOW: "0 4px 10px rgba(20,49,106,0.2), inset 0 1px 0 rgba(255,255,255,0.12)",
  TODAY_RING: "0 0 0 2px rgba(20,49,106,0.18)",
  TODAY_COMPLETED_RING: "0 0 0 3px rgba(20,49,106,0.25)",
  MISSED_BG:
    "repeating-linear-gradient(135deg, rgba(28,28,30,0.03), rgba(28,28,30,0.03) 6px, rgba(28,28,30,0.015) 6px, rgba(28,28,30,0.015) 12px), rgba(28,28,30,0.03)",
};

const MODAL_CLOSE_MS = 200;

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
    borderRadius: 16,
    transition: "200ms ease",
  };

  if (isFuture) {
    style.color = "rgba(28,28,30,0.35)";
    style.background = "transparent";
    return style;
  }
  if (isTooOld || isBeforeAccountStart) {
    style.color = "rgba(28,28,30,0.22)";
    style.background = "transparent";
    return style;
  }

  if (hasAnswer) {
    style.background = CALENDAR.COMPLETED_BG;
    style.color = "#FFFFFF";
    style.boxShadow = CALENDAR.COMPLETED_SHADOW;
    if (isToday) {
      style.boxShadow = `${CALENDAR.COMPLETED_SHADOW}, ${CALENDAR.TODAY_COMPLETED_RING}`;
    }
    return style;
  }

  if (isToday) {
    style.color = COLORS.TEXT_PRIMARY;
    style.background = "transparent";
    style.boxShadow = CALENDAR.TODAY_RING;
    return style;
  }

  style.color = "rgba(28,28,30,0.55)";
  style.background = CALENDAR.MISSED_BG;
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [calendarAnswersMap, setCalendarAnswersMap] = useState<
    Map<string, { questionText: string; answerText: string }>
  >(new Map());
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [recapModal, setRecapModal] = useState<{ open: boolean; count: number | null }>({
    open: false,
    count: null,
  });
  const [initialQuestionDayKey, setInitialQuestionDayKey] = useState<string | null>(null);

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
    let count: number;
    if (process.env.NODE_ENV === "development" && effectiveUser.id === "dev-user") {
      count = 7;
    } else {
      count = await fetchPreviousWeekAnswerCount(effectiveUser.id);
    }
    setRecapModal({ open: true, count });
  };

  const closeRecapModal = (goToCalendar?: boolean) => {
    const today = getNow();
    if (typeof window !== "undefined") {
      localStorage.setItem("dailyq_recap_" + getLocalDayKey(today), "1");
    }
    setRecapModal((prev) => ({ ...prev, open: false }));
    if (goToCalendar) setActiveTab("calendar");
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
        setCheckingAuth(false);

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          console.log('🔄 Auth state changed:', _event);
          // In development, keep dev user when session is null so submit still works
          if (process.env.NODE_ENV === "development" && !session?.user) {
            setUser(DEV_USER);
          } else {
            setUser(session?.user ?? null);
          }
          setCheckingAuth(false);
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (authError) {
        // If Supabase fails in development, use dev user so app still works
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Supabase auth failed, using dev user');
          setUser(DEV_USER);
        }
        console.error('Auth error:', authError);
        setCheckingAuth(false);
      }
    };

    const cleanup = initAuth();
    return () => {
      cleanup?.then(fn => fn?.());
    };
  }, []);

  const effectiveUser = getCurrentUser(user);

  const loadCurrentStreak = async () => {
    if (!effectiveUser) return;
    if (process.env.NODE_ENV === 'development' && effectiveUser.id === 'dev-user') {
      setCurrentStreak(0);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const today = getNow();
      const dayKey = getLocalDayKey(today);
      const streak = await computeStreak({ supabase, userId: effectiveUser.id, dayKey });
      setCurrentStreak(streak);
    } catch (e) {
      console.error('Failed to load streak:', e);
      setCurrentStreak(0);
    }
  };

  useEffect(() => {
    if (effectiveUser && effectiveUser.id !== 'dev-user') {
      loadCurrentStreak();
    } else {
      setCurrentStreak(0);
    }
  }, [effectiveUser]);

  if (checkingAuth) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.BACKGROUND_GRADIENT,
        }}
      >
        <p style={{ color: COLORS.TEXT_PRIMARY }}>Laden…</p>
      </div>
    );
  }

  if (!effectiveUser) {
    return <OnboardingScreen />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        maxHeight: "100dvh",
        background: COLORS.BACKGROUND_GRADIENT,
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "24px",
          background: COLORS.BACKGROUND,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <span
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif',
              fontSize: 32,
              letterSpacing: "0.14em",
              color: "#3C3C3E",
            }}
          >
            <span style={{ fontWeight: 400 }}>Daily</span>
            <span style={{ fontWeight: 700, color: COLORS.ACCENT }}>Q</span>
          </span>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: "0.25rem",
          }}
        >
          {activeTab === "today" && (
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "999px",
                background: GLASS.BG,
                backdropFilter: GLASS.BLUR,
                border: GLASS.BORDER,
                boxShadow: GLASS.SHADOW,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: COLORS.ACCENT,
                }}
              >
                {currentStreak}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          position: "relative",
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
          onStreakUpdate={setCurrentStreak}
          onAfterAnswerSaved={onAfterAnswerSaved}
          initialQuestionDayKey={initialQuestionDayKey}
          onClearInitialDay={() => setInitialQuestionDayKey(null)}
          onShowRecapTest={
            process.env.NODE_ENV === "development"
              ? () => setRecapModal({ open: true, count: 3 })
              : undefined
          }
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
          onAnswerMissedDay={(dayKey) => {
            setInitialQuestionDayKey(dayKey);
            setActiveTab("today");
          }}
        />
        </div>
        <div
          style={{
            display: activeTab === "settings" ? "flex" : "none",
            height: "100%",
          }}
        >
          <SettingsView user={effectiveUser} />
        </div>
      </main>

      {/* Tab bar */}
      <nav
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-evenly",
          alignItems: "center",
          background: GLASS.STRONG_BG,
          backdropFilter: GLASS.BLUR,
          border: GLASS.BORDER,
          borderRadius: 28,
          boxShadow: GLASS.TAB_SHADOW,
          paddingTop: "12px",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          margin: "0 24px",
          marginTop: "-24px",
          marginBottom: "24px",
        }}
      >
        <TabButton
          active={activeTab === "today"}
          onClick={() => setActiveTab("today")}
          label="Vandaag"
          icon={<QuestionMarkIcon />}
        />
        <TabButton
          active={activeTab === "calendar"}
          onClick={() => setActiveTab("calendar")}
          label="Kalender"
          icon={<CalendarIcon />}
        />
        <TabButton
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
          label="Instellingen"
          icon={<SettingsIcon />}
        />
      </nav>

      {recapModal.open && recapModal.count !== null && (
        <MondayRecapModal
          count={recapModal.count}
          onClose={() => closeRecapModal()}
          onAnswerMissedDay={() => closeRecapModal(true)}
        />
      )}
    </div>
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
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        padding: 0,
        cursor: "pointer",
        transition: "150ms ease",
        background: active ? COLORS.ACCENT : "transparent",
        color: active ? "#FFFFFF" : "rgba(28,28,30,0.5)",
      }}
    >
      {icon}
    </button>
  );
}

// Simple inline SVG icons
function QuestionMarkIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CheckIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ============ ONBOARDING SCREEN ============
function OnboardingScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      
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
      console.error('Auth error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: COLORS.BACKGROUND_GRADIENT,
        padding: "2rem 24px",
        overflow: "hidden",
      }}
    >
      {/* Main content */}
      <div
        style={{
          maxWidth: "24rem",
          width: "100%",
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          background: GLASS.BG,
          backdropFilter: GLASS.BLUR,
          border: GLASS.BORDER,
          boxShadow: GLASS.SHADOW,
          borderRadius: 26,
          padding: "2.5rem 2rem",
        }}
      >
        <div style={{ marginBottom: "3rem" }}>
          <span
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif',
              fontSize: 32,
              letterSpacing: "0.14em",
              color: "#3C3C3E",
            }}
          >
            <span style={{ fontWeight: 400 }}>Daily</span>
            <span style={{ fontWeight: 700, color: COLORS.ACCENT }}>Q</span>
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            disabled={submitting}
            autoComplete="email"
            style={{
              width: "100%",
              padding: "1rem 1.25rem",
              fontSize: 16,
              border: "1px solid rgba(28,28,30,0.2)",
              borderRadius: "999px",
              background: GLASS.BG,
              color: COLORS.TEXT_PRIMARY,
              marginBottom: "1rem",
              outline: "none",
              transition: "150ms ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(20,49,106,0.2)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(28,28,30,0.2)";
            }}
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            disabled={submitting}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            style={{
              width: "100%",
              padding: "1rem 1.25rem",
              fontSize: 16,
              border: "1px solid rgba(28,28,30,0.2)",
              borderRadius: "999px",
              background: GLASS.BG,
              color: COLORS.TEXT_PRIMARY,
              marginBottom: "1rem",
              outline: "none",
              transition: "150ms ease",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgba(20,49,106,0.2)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(28,28,30,0.2)";
            }}
          />

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password.trim()}
            style={{
              width: "100%",
              height: 54,
              padding: "0 1.25rem",
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.2px",
              border: "none",
              borderRadius: 999,
              background: COLORS.ACCENT,
              color: "#FFFFFF",
              cursor: submitting ? "default" : "pointer",
              opacity: submitting || !email.trim() || !password.trim() ? 0.6 : 1,
              transition: "150ms ease",
              marginBottom: "1rem",
            }}
          >
            {submitting ? (isSignUp ? "Bezig met registreren…" : "Bezig met inloggen…") : (isSignUp ? "Registreren" : "Inloggen")}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            disabled={submitting}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: 16,
              border: "none",
              background: "transparent",
              color: COLORS.TEXT_SECONDARY,
              fontWeight: 500,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.6 : 1,
              textDecoration: "underline",
            }}
          >
            {isSignUp ? "Heb je al een account? Log in" : "Nog geen account? Registreer"}
          </button>

          {error && (
            <p style={{ color: COLORS.TEXT_PRIMARY, marginTop: "1rem", fontSize: 16 }}>
              {error}
            </p>
          )}
        </form>
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
      colors: ["#14316A", "#EEF2F7", "#FFFFFF"],
      ticks: 100,
    });
  });
}

function StreakModal({ streak, onClose }: { streak: number; onClose: () => void }) {
  const [isClosing, setIsClosing] = useState(false);
  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => onClose(), MODAL_CLOSE_MS);
  };
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        zIndex: 2000,
        animation: isClosing ? `fadeOut ${MODAL_CLOSE_MS}ms ease-out` : "fadeIn 0.2s ease-out forwards",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          position: "relative",
          background: COLORS.BACKGROUND,
          border: GLASS.BORDER,
          boxShadow: GLASS.SHADOW,
          borderRadius: 26,
          padding: "3rem 2rem",
          maxWidth: "24rem",
          width: "100%",
          textAlign: "center",
          animation: isClosing ? `scaleOut ${MODAL_CLOSE_MS}ms ease-out` : "streakEnter 0.2s ease-out forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Sluiten"
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: COLORS.TEXT_SECONDARY,
            fontSize: "1.5rem",
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
        <p
          style={{
            fontSize: "2rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
            color: COLORS.TEXT_PRIMARY,
          }}
        >
          Yay!
        </p>
        <p
          style={{
            fontSize: "1.25rem",
            color: COLORS.TEXT_PRIMARY,
            marginBottom: "2rem",
          }}
        >
          Je hebt nu een streak van {streak} {streak === 1 ? "dag" : "dagen"}.
        </p>
        <button
          type="button"
          onClick={handleClose}
          style={{
            height: 54,
            padding: "0 2rem",
            borderRadius: 999,
            border: "none",
            background: COLORS.ACCENT,
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "0.2px",
            cursor: "pointer",
            transition: "150ms ease",
          }}
        >
          Sluiten
        </button>
      </div>
    </div>
  );
}

// ============ MONDAY RECAP MODAL ============
function MondayRecapModal({
  count,
  onClose,
  onAnswerMissedDay,
}: {
  count: number;
  onClose: () => void;
  onAnswerMissedDay: () => void;
}) {
  const isPerfect = count === 7;
  const [isClosing, setIsClosing] = useState(false);
  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => onClose(), MODAL_CLOSE_MS);
  };
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        zIndex: 2000,
        animation: isClosing ? `fadeOut ${MODAL_CLOSE_MS}ms ease-out` : "fadeIn 0.2s ease-out forwards",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          position: "relative",
          background: COLORS.BACKGROUND,
          border: GLASS.BORDER,
          boxShadow: GLASS.SHADOW,
          borderRadius: 26,
          padding: "3rem 2rem",
          maxWidth: "24rem",
          width: "100%",
          textAlign: "center",
          animation: isClosing ? `scaleOut ${MODAL_CLOSE_MS}ms ease-out` : "streakEnter 0.2s ease-out forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Sluiten"
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: COLORS.TEXT_SECONDARY,
            fontSize: "1.5rem",
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
        <p
          style={{
            fontSize: "1.25rem",
            color: COLORS.TEXT_PRIMARY,
            marginBottom: "2rem",
            lineHeight: 1.45,
          }}
        >
          Je hebt {count} van de 7 vragen vorige week beantwoord.
        </p>
        {isPerfect && (
          <p style={{ fontSize: "1.5rem", fontWeight: 600, color: COLORS.ACCENT, marginBottom: "1.5rem" }}>
            🎉
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {isPerfect ? (
            <button
              type="button"
              onClick={handleClose}
              style={{
                height: 54,
                padding: "0 2rem",
                borderRadius: 999,
                border: "none",
                background: COLORS.ACCENT,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.2px",
                cursor: "pointer",
                transition: "150ms ease",
              }}
            >
              Mooi
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onAnswerMissedDay}
                style={{
                  height: 54,
                  padding: "0 2rem",
                  borderRadius: 999,
                  border: "none",
                  background: COLORS.ACCENT,
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "0.2px",
                  cursor: "pointer",
                  transition: "150ms ease",
                }}
              >
                Beantwoord een gemiste dag
              </button>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  padding: "0.75rem",
                  fontSize: 16,
                  border: "none",
                  background: "transparent",
                  color: COLORS.TEXT_SECONDARY,
                  cursor: "pointer",
                  transition: "150ms ease",
                }}
              >
                Sluiten
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ TODAY VIEW ============
function TodayView({
  user: effectiveUser,
  onCalendarUpdate,
  onStreakUpdate,
  onAfterAnswerSaved,
  initialQuestionDayKey,
  onClearInitialDay,
  onShowRecapTest,
}: {
  user: any;
  onCalendarUpdate: ((dayKey: string, questionText: string, answerText: string) => void) | null;
  onStreakUpdate?: (streak: number) => void;
  onAfterAnswerSaved?: (dayKey: string) => void | Promise<void>;
  initialQuestionDayKey?: string | null;
  onClearInitialDay?: () => void;
  onShowRecapTest?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [streakOverlay, setStreakOverlay] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showEditConfirmation, setShowEditConfirmation] = useState(false);
  const [editConfirmationClosing, setEditConfirmationClosing] = useState(false);

  const closeEditConfirmation = () => {
    setEditConfirmationClosing(true);
    setTimeout(() => {
      setShowEditConfirmation(false);
      setEditConfirmationClosing(false);
    }, MODAL_CLOSE_MS);
  };

  useEffect(() => {
    registerServiceWorker();

    const load = async () => {
      console.log('🔧 TodayView: Starting to load...');
      
      setLoading(true);
      setError(null);

      try {
        if (typeof window !== "undefined" && !window.navigator.onLine) {
          setOffline(true);
        }

        const dayKey = initialQuestionDayKey ?? getLocalDayKey(getNow());

        // In development with dev user, skip database and use mock data
        if (effectiveUser?.id === 'dev-user') {
          console.log('👤 Mock user detected - using mock question immediately');
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
          
          // 2 second timeout for faster feedback
          const queryPromise = supabase
            .from("questions")
            .select("id, text, day")
            .eq("day", dayKey)
            .maybeSingle();

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), 2000)
          );
          
          const result: any = await Promise.race([queryPromise, timeoutPromise]);
          
          console.log('✅ Successfully fetched question from Supabase');

          const { data, error: questionError } = result;

          if (questionError) {
            throw questionError;
          }

          questionData = data;
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
          setQuestion(null);
          setLoading(false);
          return;
        }

        setQuestion(questionData);

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
              .eq("question_id", questionData.id)
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
  }, [initialQuestionDayKey]);

  const handleSubmit = async () => {
    if (!question || !draft.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setStreakOverlay(null);

    try {
      const today = getNow();
      const dayKey = initialQuestionDayKey ?? getLocalDayKey(today);

      if (!effectiveUser) {
        setError("Log in om een antwoord te versturen.");
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
        
        // Save mock answer to localStorage
        try {
          const mockAnswerKey = `dev-answer-${dayKey}`;
          localStorage.setItem(mockAnswerKey, draft);
        } catch (e) {
          console.warn('Could not save mock answer to localStorage');
        }
        
        setAnswer({
          id: 'dev-answer-id',
          answer_text: draft,
        });
        if (onCalendarUpdate) onCalendarUpdate(dayKey, question.text, draft);
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
          fireConfetti();
          setStreakOverlay(1); // Show streak modal with day 1
        }
        setDraft(''); // Clear the draft
        setIsEditMode(false); // Exit edit mode
        if (initialQuestionDayKey) onClearInitialDay?.();
        if (isMonday(today)) void onAfterAnswerSaved?.(dayKey);
      } else {
        const supabase = createSupabaseBrowserClient();
        try {
          await saveAnswerAndStreak({
            supabase,
            userId: effectiveUser.id,
            questionId: question.id,
            draft,
            dayKey,
            questionText: question.text,
            setAnswer,
            setStreakOverlay,
            onCalendarUpdate,
            onStreakUpdate,
            isEdit: editingExisting,
            userCreatedAt: effectiveUser.created_at,
          });
        } catch (dbError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ Database save failed in development, simulating success');
            setAnswer({ id: 'dev-answer-id', answer_text: draft });
            if (onCalendarUpdate) onCalendarUpdate(dayKey, question.text, draft);
            if (!editingExisting) {
              fireConfetti();
              setStreakOverlay(1);
            }
            if (onStreakUpdate) onStreakUpdate(1);
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
        }
        setDraft('');
        setIsEditMode(false);
        console.log('✅ Real user submission complete - answer set, draft cleared, edit mode off');
        if (initialQuestionDayKey) onClearInitialDay?.();
        if (isMonday(today)) void onAfterAnswerSaved?.(dayKey);
      }
    } catch (e) {
      setError("Je antwoord kon niet worden verstuurd. Probeer het opnieuw.");
      console.error(e);
    } finally {
      setSubmitting(false);
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
        <p style={{ color: COLORS.TEXT_PRIMARY }}>Vraag van vandaag laden…</p>
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
        <p style={{ color: COLORS.TEXT_PRIMARY }}>Er staat geen vraag voor vandaag.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "2rem 24px",
        height: "100%",
        width: "100%",
        backgroundColor: COLORS.BACKGROUND,
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <section style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {answer && !isEditMode ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "clamp(2rem, 10vh, 5rem) 24px",
              marginTop: "4rem",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "28rem",
                padding: "2.5rem 2rem",
                borderRadius: 26,
                background: COLORS.BACKGROUND,
                border: GLASS.BORDER,
                boxShadow: GLASS.SHADOW,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  color: COLORS.TEXT_PRIMARY,
                  fontWeight: 500,
                  fontSize: "1.125rem",
                  letterSpacing: "0.025em",
                }}
              >
                <span>Klaar voor vandaag</span>
                <span style={{ display: "inline-flex", alignItems: "center", opacity: 0.9 }}>
                  <CheckIconSmall />
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  marginTop: "1.25rem",
                  fontSize: "1.125rem",
                  lineHeight: 1.625,
                  color: COLORS.TEXT_SECONDARY,
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                {question.text}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsEditMode(true);
                setDraft(answer.answer_text);
              }}
              style={{
                marginTop: "3rem",
                padding: "1rem 2rem",
                borderRadius: 999,
                border: GLASS.BORDER,
                background: GLASS.BG,
                color: COLORS.ACCENT,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                transition: "150ms ease",
              }}
            >
              Antwoord bewerken
            </button>
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
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "stretch",
              padding: "1.5rem 0",
            }}
          >
            <p
              style={{
                fontSize: "0.875rem",
                color: COLORS.TEXT_SECONDARY,
                textAlign: "center",
                marginTop: 0,
                marginBottom: "0.75rem",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontWeight: 500,
              }}
            >
              Vraag van vandaag
            </p>
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: 600,
                textAlign: "center",
                marginBottom: "3.5rem",
                marginTop: 0,
                color: COLORS.TEXT_PRIMARY,
                lineHeight: 1.3,
              }}
            >
              {question.text}
            </h1>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Typ je antwoord…"
              style={{
                minHeight: "12rem",
                padding: "1.25rem",
                borderRadius: 16,
                border: "1px solid rgba(28,28,30,0.2)",
                background: GLASS.BG,
                resize: "vertical",
                fontFamily: "inherit",
                fontSize: 16,
                lineHeight: 1.45,
                color: COLORS.TEXT_PRIMARY,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "rgba(20,49,106,0.2)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(28,28,30,0.2)";
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                marginTop: "1.5rem",
                height: 54,
                padding: "0 2rem",
                borderRadius: 999,
                border: "none",
                background: COLORS.ACCENT,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.2px",
                cursor: "pointer",
                transition: "150ms ease",
              }}
              disabled={submitting}
            >
              {answer ? "Bijwerken" : "Versturen"}
            </button>
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

      {streakOverlay !== null && (
        <StreakModal streak={streakOverlay} onClose={() => setStreakOverlay(null)} />
      )}

      {showEditConfirmation && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            zIndex: 2000,
            animation: editConfirmationClosing ? `fadeOut ${MODAL_CLOSE_MS}ms ease-out` : "fadeIn 0.2s ease-out forwards",
          }}
          onClick={closeEditConfirmation}
        >
          <div
            style={{
              position: "relative",
              background: COLORS.BACKGROUND,
              border: GLASS.BORDER,
              boxShadow: GLASS.SHADOW,
              borderRadius: 26,
              padding: "3rem 2rem",
              maxWidth: "24rem",
              width: "100%",
              textAlign: "center",
              animation: editConfirmationClosing ? `scaleOut ${MODAL_CLOSE_MS}ms ease-out` : "streakEnter 0.2s ease-out forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Sluiten"
              onClick={closeEditConfirmation}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                color: COLORS.TEXT_SECONDARY,
                fontSize: "1.5rem",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
            <p
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                color: COLORS.TEXT_PRIMARY,
                margin: 0,
              }}
            >
              Antwoord gewijzigd
            </p>
          </div>
        </div>
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
        const { data, error: fetchError } = await supabase
          .from("questions")
          .select("id, text, day")
          .eq("day", dayKey)
          .maybeSingle();
        if (cancelled) return;
        if (fetchError) {
          setError("Vraag kon niet worden geladen.");
          setLoading(false);
          return;
        }
        if (data) {
          setQuestion(data);
        } else {
          setError("Geen vraag beschikbaar voor deze dag.");
        }
      } catch (e) {
        if (!cancelled) setError("Er ging iets mis.");
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
      setSubmitError("Deze datum is vóór het begin van je account.");
      return;
    }
    if (!canAnswerDate(dayKeyAsDate)) {
      setSubmitError("Deze datum valt buiten de 7-dagen periode.");
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
      await saveAnswerAndStreak({
        supabase,
        userId: user.id,
        questionId: question.id,
        draft,
        dayKey,
        questionText: question.text,
        setAnswer: () => {},
        setStreakOverlay: () => {},
        onCalendarUpdate: null,
        userCreatedAt: user.created_at,
      });
      setIsClosing(true);
      setTimeout(() => {
        onSuccess(dayKey, question.text, draft);
        onClose();
      }, MODAL_CLOSE_MS);
    } catch (e: any) {
      setSubmitError(e?.message ?? "Opslaan mislukt.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        zIndex: 1100,
        animation: isClosing ? `fadeOut ${MODAL_CLOSE_MS}ms ease-out` : "fadeIn 0.2s ease-out forwards",
      }}
    >
      <div
        style={{
          position: "relative",
          background: COLORS.BACKGROUND,
          border: GLASS.BORDER,
          boxShadow: GLASS.SHADOW,
          borderRadius: 26,
          padding: "1.5rem",
          maxWidth: "28rem",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          animation: isClosing ? `scaleOut ${MODAL_CLOSE_MS}ms ease-out` : "streakEnter 0.2s ease-out forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Sluiten"
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: COLORS.TEXT_SECONDARY,
            fontSize: "1.5rem",
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>

        {loading && (
          <p style={{ color: COLORS.TEXT_SECONDARY, padding: "2rem 0" }}>Vraag laden…</p>
        )}
        {error && !loading && (
          <div style={{ padding: "1rem 0" }}>
            <p style={{ color: COLORS.TEXT_PRIMARY, marginBottom: "1rem" }}>{error}</p>
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
              Sluiten
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
              Vraag van die dag
            </p>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: COLORS.TEXT_PRIMARY }}>
              {question.text}
            </h3>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Typ je antwoord…"
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
                {submitError}
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
                borderRadius: 999,
                border: "none",
                background: COLORS.ACCENT,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.2px",
                cursor: submitting ? "default" : "pointer",
                opacity: submitting || !draft.trim() ? 0.6 : 1,
                transition: "150ms ease",
              }}
            >
              {submitting ? "Bezig…" : "Versturen"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ CALENDAR VIEW ============
function CalendarView({
  answersMap,
  setAnswersMap,
  user,
  onAnswerMissedDay,
}: {
  answersMap: Map<string, { questionText: string; answerText: string }>;
  setAnswersMap: React.Dispatch<React.SetStateAction<Map<string, { questionText: string; answerText: string }>>>;
  user: any;
  onAnswerMissedDay?: (dayKey: string) => void;
}) {
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
  const [missedDayModal, setMissedDayModal] = useState<"missed" | "closed" | null>(null);
  const [missedDayKey, setMissedDayKey] = useState<string | null>(null);
  const [selectedDateForAnswer, setSelectedDateForAnswer] = useState<string | null>(null);
  const [closingMissedModal, setClosingMissedModal] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchAnswers = async () => {
      setLoading(true);
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
          setLoading(false);
          return;
        }

        const supabase = createSupabaseBrowserClient();
        const startOfMonth = new Date(displayYear, displayMonth, 1);
        const endOfMonth = new Date(displayYear, displayMonth + 1, 0);

        const { data, error: fetchError } = await supabase
          .from("answers")
          .select("answer_text, questions!inner(text, day)")
          .eq("user_id", user.id)
          .gte("questions.day", startOfMonth.toISOString().slice(0, 10))
          .lte("questions.day", endOfMonth.toISOString().slice(0, 10));

        if (fetchError) throw fetchError;

        const map = new Map<
          string,
          { questionText: string; answerText: string }
        >();
        if (data) {
          for (const row of data as any[]) {
            const q = row.questions as { text: string; day: string };
            if (q && q.day) {
              map.set(q.day, {
                questionText: q.text,
                answerText: row.answer_text,
              });
            }
          }
        }
        setAnswersMap((prev) => {
          const merged = new Map(prev);
          for (const [k, v] of map) merged.set(k, v);
          return merged;
        });
      } catch (e) {
        setError("Antwoorden voor deze maand konden niet worden geladen.");
        console.error(e);
      } finally {
        setLoading(false);
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
        <p style={{ color: COLORS.TEXT_PRIMARY }}>Log in om je antwoorden te zien.</p>
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
        <p style={{ color: COLORS.TEXT_PRIMARY }}>Kalender laden…</p>
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

  const firstDay = new Date(displayYear, displayMonth, 1).getDay();
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const todayKey = getLocalDayKey(getNow());

  let capturedThisMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = getLocalDayKey(new Date(displayYear, displayMonth, d));
    if (answersMap.has(dk)) capturedThisMonth++;
  }

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }

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
      setMissedDayModal(canAnswerDate(dayDate) ? "missed" : "closed");
    }
  };

  const handleCloseMissedModal = () => {
    if (closingMissedModal) return;
    setClosingMissedModal(true);
    setTimeout(() => {
      setMissedDayModal(null);
      setMissedDayKey(null);
      setClosingMissedModal(false);
    }, MODAL_CLOSE_MS);
  };

  const handleAnswerMissedDay = () => {
    if (closingMissedModal || !missedDayKey) return;
    const keyToOpen = missedDayKey;
    setClosingMissedModal(true);
    setTimeout(() => {
      setMissedDayModal(null);
      setMissedDayKey(null);
      setClosingMissedModal(false);
      requestAnimationFrame(() => {
        setSelectedDateForAnswer(keyToOpen);
      });
    }, MODAL_CLOSE_MS);
  };

  const handleCloseModal = () => {
    setClosingModal(true);
    setTimeout(() => {
      setSelectedDay(null);
      setClosingModal(false);
    }, MODAL_CLOSE_MS);
  };

  return (
    <div 
      style={{ 
        height: "100%",
        width: "100%",
        padding: "1rem 0",
        position: "relative",
        overflowY: "auto",
        overflowX: "hidden",
        boxSizing: "border-box",
        background: COLORS.BACKGROUND,
      }}
    >
      <div 
        style={{ 
          padding: "0 24px", 
          width: "100%", 
          boxSizing: "border-box",
          paddingTop: "clamp(1rem, 12vh, 5rem)",
          background: COLORS.BACKGROUND,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <button
            type="button"
            onClick={prevMonth}
            style={{
              padding: "0.5rem",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "1.25rem",
              color: COLORS.TEXT_PRIMARY,
            }}
          >
            ‹
          </button>
          <h2 style={{ fontSize: "22px", fontWeight: 600, color: COLORS.TEXT_PRIMARY }}>
            {monthNames[displayMonth]} {displayYear}
          </h2>
          <button
            type="button"
            onClick={nextMonth}
            style={{
              padding: "0.5rem",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "1.25rem",
              color: COLORS.TEXT_PRIMARY,
            }}
          >
            ›
          </button>
        </div>

        <p
          style={{
            fontSize: "0.8125rem",
            color: COLORS.TEXT_SECONDARY,
            marginBottom: "1rem",
            textAlign: "center",
          }}
        >
          {capturedThisMonth} / {daysInMonth} vragen beantwoord deze maand
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "0.75rem",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          {["zo", "ma", "di", "wo", "do", "vr", "za"].map((dow) => (
            <div
              key={dow}
              style={{
                textAlign: "center",
                fontSize: "0.875rem",
                fontWeight: 600,
                padding: "0.5rem",
                color: COLORS.TEXT_SECONDARY,
                minWidth: 0,
                boxSizing: "border-box",
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
      </div>

      {selectedDay && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            zIndex: 1000,
            animation: closingModal ? `fadeOut ${MODAL_CLOSE_MS}ms ease-out` : "fadeIn 0.2s ease-out forwards",
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              position: "relative",
              background: COLORS.BACKGROUND,
              border: GLASS.BORDER,
              boxShadow: GLASS.SHADOW,
              borderRadius: 26,
              padding: "1.5rem",
              maxWidth: "28rem",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              animation: closingModal ? `scaleOut ${MODAL_CLOSE_MS}ms ease-out` : "scaleIn 0.2s ease-out forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Sluiten"
              onClick={handleCloseModal}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                color: COLORS.TEXT_SECONDARY,
                fontSize: "1.5rem",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
              }}
            >
              ×
            </button>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: COLORS.TEXT_PRIMARY }}>
              {selectedDay.questionText}
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.45, marginBottom: "1.5rem", color: COLORS.TEXT_PRIMARY }}>
              {selectedDay.answerText}
            </p>
            <button
              type="button"
              onClick={handleCloseModal}
              style={{
                height: 54,
                padding: "0 1.5rem",
                borderRadius: 999,
                border: "none",
                background: COLORS.ACCENT,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.2px",
                cursor: "pointer",
                transition: "150ms ease",
              }}
            >
              Sluiten
            </button>
          </div>
        </div>
      )}

      {missedDayModal === "missed" && missedDayKey && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            zIndex: 1000,
            animation: closingMissedModal ? `fadeOut ${MODAL_CLOSE_MS}ms ease-out` : "fadeIn 0.2s ease-out forwards",
          }}
          onClick={handleCloseMissedModal}
        >
          <div
            style={{
              position: "relative",
              background: COLORS.BACKGROUND,
              border: GLASS.BORDER,
              boxShadow: GLASS.SHADOW,
              borderRadius: 26,
              padding: "1.5rem",
              maxWidth: "28rem",
              width: "100%",
              animation: closingMissedModal ? `scaleOut ${MODAL_CLOSE_MS}ms ease-out` : "scaleIn 0.2s ease-out forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Sluiten"
              onClick={handleCloseMissedModal}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                color: COLORS.TEXT_SECONDARY,
                fontSize: "1.5rem",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: COLORS.TEXT_PRIMARY }}>
              Je hebt deze dag gemist
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.45, marginBottom: "1.5rem", color: COLORS.TEXT_SECONDARY }}>
              Wil je die nu alsnog beantwoorden?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={handleAnswerMissedDay}
                style={{
                  height: 54,
                  padding: "0 1.5rem",
                  borderRadius: 999,
                  border: "none",
                  background: COLORS.ACCENT,
                  color: "#FFFFFF",
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: "0.2px",
                  cursor: "pointer",
                  transition: "150ms ease",
                }}
              >
                Nu beantwoorden
              </button>
              <button
                type="button"
                onClick={handleCloseMissedModal}
                style={{
                  padding: "0.75rem",
                  fontSize: 16,
                  border: "none",
                  background: "transparent",
                  color: COLORS.TEXT_SECONDARY,
                  cursor: "pointer",
                }}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {missedDayModal === "closed" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            zIndex: 1000,
            animation: closingMissedModal ? `fadeOut ${MODAL_CLOSE_MS}ms ease-out` : "fadeIn 0.2s ease-out forwards",
          }}
          onClick={handleCloseMissedModal}
        >
          <div
            style={{
              position: "relative",
              background: COLORS.BACKGROUND,
              border: GLASS.BORDER,
              boxShadow: GLASS.SHADOW,
              borderRadius: 26,
              padding: "1.5rem",
              maxWidth: "28rem",
              width: "100%",
              animation: closingMissedModal ? `scaleOut ${MODAL_CLOSE_MS}ms ease-out` : "scaleIn 0.2s ease-out forwards",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Sluiten"
              onClick={handleCloseMissedModal}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                color: COLORS.TEXT_SECONDARY,
                fontSize: "1.5rem",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ×
            </button>
            <h3 style={{ fontSize: "1.25rem", marginBottom: "0.75rem", color: COLORS.TEXT_PRIMARY }}>
              Deze dag is gesloten
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.45, marginBottom: "1.5rem", color: COLORS.TEXT_SECONDARY }}>
              Je kunt alleen vragen van de afgelopen 7 dagen beantwoorden.
            </p>
            <button
              type="button"
              onClick={handleCloseMissedModal}
              style={{
                height: 54,
                padding: "0 1.5rem",
                borderRadius: 999,
                border: "none",
                background: COLORS.ACCENT,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.2px",
                cursor: "pointer",
                transition: "150ms ease",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {selectedDateForAnswer && user && (
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
        />
      )}
    </div>
  );
}

// ============ SETTINGS VIEW ============
function SettingsView({ user }: { user: any }) {
  const [signingOut, setSigningOut] = useState(false);

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

  return (
    <div
      style={{
        padding: "24px",
        width: "100%",
      }}
    >
      <h2 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "1.5rem", color: COLORS.TEXT_PRIMARY }}>Instellingen</h2>

      <div style={{ marginBottom: "2rem" }}>
        {user && user.email && (
          <p style={{ fontSize: 16, color: COLORS.TEXT_SECONDARY, marginBottom: "1rem" }}>
            Ingelogd als: {user.email}
          </p>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: 999,
            border: GLASS.BORDER,
            background: GLASS.BG,
            color: COLORS.ACCENT,
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
            transition: "150ms ease",
          }}
        >
          {signingOut ? "Bezig met uitloggen…" : "Uitloggen"}
        </button>
      </div>

      <div style={{ borderTop: "1px solid rgba(28,28,30,0.1)", paddingTop: "1.5rem" }}>
        <p style={{ fontSize: 16, marginBottom: "0.5rem", color: COLORS.TEXT_PRIMARY }}>
          <strong>DailyQ</strong>
        </p>
        <p style={{ fontSize: "0.85rem", color: COLORS.TEXT_SECONDARY }}>Versie 1.2</p>
        <p style={{ fontSize: "0.85rem", color: COLORS.TEXT_SECONDARY, marginTop: "0.5rem" }}>
          One question a day.
        </p>
        <a
          href="https://instagram.com/tjadevz"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: "1rem",
            fontSize: "0.85rem",
            color: COLORS.ACCENT,
            textDecoration: "underline",
          }}
        >
          @tjadevz
        </a>
      </div>
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
    .select("id, questions!inner(day)")
    .eq("user_id", userId)
    .gte("questions.day", start)
    .lte("questions.day", end);
  if (error) return 0;
  return (data ?? []).length;
}

async function saveAnswerAndStreak(params: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  userId: string;
  questionId: string;
  draft: string;
  dayKey: string;
  questionText: string;
  setAnswer: (a: Answer) => void;
  setStreakOverlay: (streak: number) => void;
  onCalendarUpdate: ((dayKey: string, questionText: string, answerText: string) => void) | null;
  onStreakUpdate?: (streak: number) => void;
  isEdit?: boolean;
  userCreatedAt?: string;
}) {
  const { supabase, userId, questionId, draft, dayKey, questionText, setAnswer, setStreakOverlay, onCalendarUpdate, onStreakUpdate, isEdit, userCreatedAt } =
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

  const { data: upserted, error: upsertError } = await supabase
    .from("answers")
    .upsert(
      {
        user_id: userId,
        question_id: questionId,
        answer_text: draft,
      },
      {
        onConflict: "user_id,question_id",
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

  // Optimistically update calendar
  if (onCalendarUpdate) {
    onCalendarUpdate(dayKey, questionText, draft);
  }

  const streak = await computeStreak({ supabase, userId, dayKey });
  
  // Only show streak modal for new answers, not edits
  if (!isEdit) {
    fireConfetti();
    setStreakOverlay(streak);
  }

  // Update header streak
  if (onStreakUpdate) {
    onStreakUpdate(streak);
  }
}

async function computeStreak(params: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  userId: string;
  dayKey: string;
}): Promise<number> {
  const { supabase, userId, dayKey } = params;

  const { data, error } = await supabase
    .from("answers")
    .select(
      `
      id,
      created_at,
      questions!answers_question_id_fkey(day)
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    throw error ?? new Error("Could not load answers for streak");
  }

  const uniqueDays: string[] = [];
  for (const row of data as any[]) {
    const question = row.questions as { day: string } | null;
    if (!question?.day) continue;
    const d = question.day;
    if (!uniqueDays.includes(d)) {
      uniqueDays.push(d);
    }
  }

  let streak = 0;
  let currentDate = new Date(dayKey);

  for (let i = 0; i < uniqueDays.length; i++) {
    const key = getLocalDayKey(currentDate);
    if (!uniqueDays.includes(key)) {
      break;
    }
    streak += 1;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}
