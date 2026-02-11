"use client";
/* eslint-disable no-console */

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
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

// Style Constants
const COLORS = {
  primary: '#1A1A1A',
  secondary: '#2A2A2A',
  tertiary: '#3A3A3A',
  white: '#F2F0EC',
} as const;

const GRADIENTS = {
  horizontal: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondary})`,
  vertical: `linear-gradient(to bottom, #F2F0EC, #ebe9e5, #e8e6e2)`,
} as const;

const COMMON_STYLES = {
  pillButton: {
    borderRadius: '999px',
    padding: '1rem 2rem',
  },
  primaryBorder: `2px solid ${COLORS.primary}`,
} as const;

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
  const [onCalendarUpdate, setOnCalendarUpdate] = useState<
    ((dayKey: string, questionText: string, answerText: string) => void) | null
  >(null);
  const [currentStreak, setCurrentStreak] = useState<number>(0);

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
      const today = new Date();
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
        }}
      >
        <p>Laden…</p>
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
        background: "#F2F0EC",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "1rem 1.5rem",
          paddingTop: "1.25rem",
          paddingBottom: "1.25rem",
          background: "#F2F0EC",
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
              fontFamily: 'var(--font-logo), "SF Pro Rounded", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
              fontSize: "1.25rem",
              fontWeight: 500,
              letterSpacing: "0.03em",
              color: "#1A1A1A",
            }}
          >
            DailyQ
          </span>
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
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
                borderRadius: "50%",
                border: "1.5px solid rgba(0, 0, 0, 0.18)",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#5A5A5A",
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
          <TodayView user={effectiveUser} onCalendarUpdate={onCalendarUpdate} onStreakUpdate={setCurrentStreak} />
        </div>
        <div
          style={{
            display: activeTab === "calendar" ? "flex" : "none",
            height: "100%",
            width: "100%",
          }}
        >
          <CalendarView registerCalendarUpdate={setOnCalendarUpdate} user={effectiveUser} />
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
          background: "#F2F0EC",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0, 0, 0, 0.08)",
          paddingTop: "12px",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          marginLeft: "12px",
          marginRight: "12px",
          marginBottom: 0,
          marginTop: "-24px",
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
        transition: "background 0.2s, color 0.2s",
        background: active ? "#002E5D" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#5A5A5A",
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
        background: COLORS.white,
        padding: "2rem 1.5rem",
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
        }}
      >
        <h1
          style={{
            color: "#1A1A1A",
            fontSize: "1.75rem",
            fontWeight: 600,
            marginBottom: "3rem",
          }}
        >
          DailyQ
        </h1>

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
              fontSize: "1rem",
              border: "1px solid rgba(26, 26, 26, 0.2)",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.5)",
              color: "#1A1A1A",
              marginBottom: "1rem",
              outline: "none",
              transition: "all 0.2s",
            }}
            onFocus={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.7)";
              e.target.style.borderColor = "rgba(26, 26, 26, 0.3)";
            }}
            onBlur={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.5)";
              e.target.style.borderColor = "rgba(26, 26, 26, 0.2)";
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
              fontSize: "1rem",
              border: "1px solid rgba(26, 26, 26, 0.2)",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.5)",
              color: "#1A1A1A",
              marginBottom: "1rem",
              outline: "none",
              transition: "all 0.2s",
            }}
            onFocus={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.7)";
              e.target.style.borderColor = "rgba(26, 26, 26, 0.3)";
            }}
            onBlur={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.5)";
              e.target.style.borderColor = "rgba(26, 26, 26, 0.2)";
            }}
          />

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password.trim()}
            style={{
              width: "100%",
              padding: "1rem 1.25rem",
              fontSize: "1rem",
              border: "none",
              borderRadius: "999px",
              background: "#1A1A1A",
              color: "#FFFFFF",
              fontWeight: 600,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting || !email.trim() || !password.trim() ? 0.6 : 1,
              transition: "all 0.2s",
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
              fontSize: "0.875rem",
              border: "none",
              background: "transparent",
              color: "#1A1A1A",
              fontWeight: 500,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.6 : 1,
              textDecoration: "underline",
            }}
          >
            {isSignUp ? "Heb je al een account? Log in" : "Nog geen account? Registreer"}
          </button>

          {error && (
            <p style={{ color: "#1A1A1A", marginTop: "1rem", fontSize: "0.875rem" }}>
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
      colors: ["#1A1A1A", "#F2F0EC", "#c4b89a"],
      ticks: 100,
    });
  });
}

function StreakModal({ streak, onClose }: { streak: number; onClose: () => void }) {
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
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "1.5rem",
          padding: "3rem 2rem",
          maxWidth: "24rem",
          width: "100%",
          textAlign: "center",
          animation: "streakEnter 0.3s ease-out",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          style={{
            fontSize: "2rem",
            fontWeight: 600,
            marginBottom: "1.5rem",
            color: "#1A1A1A",
          }}
        >
          Mooi.
        </p>
        <p
          style={{
            fontSize: "1.25rem",
            color: "#1A1A1A",
            marginBottom: "2rem",
          }}
        >
          Dit is je streak van {streak} dagen.
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "0.75rem 2rem",
            borderRadius: "999px",
            border: "none",
            backgroundColor: "#1A1A1A",
            color: "#FFFFFF",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sluiten
        </button>
      </div>
    </div>
  );
}

// ============ TODAY VIEW ============
function TodayView({
  user: effectiveUser,
  onCalendarUpdate,
  onStreakUpdate,
}: {
  user: any;
  onCalendarUpdate: ((dayKey: string, questionText: string, answerText: string) => void) | null;
  onStreakUpdate?: (streak: number) => void;
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

        const today = new Date();
        const dayKey = getLocalDayKey(today);

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
  }, []);

  const handleSubmit = async () => {
    if (!question || !draft.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setStreakOverlay(null);

    try {
      const today = new Date();
      const dayKey = getLocalDayKey(today);

      if (!effectiveUser) {
        setError("Log in om een antwoord te versturen.");
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
        
        if (editingExisting) {
          setShowEditConfirmation(true);
          setTimeout(() => setShowEditConfirmation(false), 2000);
        } else {
          fireConfetti();
          setStreakOverlay(1); // Show streak modal with day 1
        }
        
        setDraft(''); // Clear the draft
        setIsEditMode(false); // Exit edit mode
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
          setTimeout(() => setShowEditConfirmation(false), 2000);
        }
        setDraft('');
        setIsEditMode(false);
        console.log('✅ Real user submission complete - answer set, draft cleared, edit mode off');
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
          padding: "1.5rem",
          boxSizing: "border-box",
        }}
      >
        <p>Vraag van vandaag laden…</p>
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
          padding: "1.5rem",
          boxSizing: "border-box",
        }}
      >
        <p>{error}</p>
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
          padding: "1.5rem",
          boxSizing: "border-box",
        }}
      >
        <p>Er staat geen vraag voor vandaag.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "2rem 1.5rem",
        height: "100%",
        width: "100%",
        backgroundColor: "#F2F0EC",
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
              padding: "clamp(2rem, 10vh, 5rem) 1.5rem",
              marginTop: "4rem",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "28rem",
                padding: "2.5rem 2rem",
                borderRadius: "1.75rem",
                background: "#FFFFFF",
                border: "none",
                boxShadow: "0 2px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)",
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
                  color: "#292524",
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
                  color: "#9ca3af",
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
                ...COMMON_STYLES.pillButton,
                marginTop: "3rem",
                border: "1px solid #d6d3d1",
                background: "transparent",
                color: "#78716c",
                fontSize: "0.9375rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background 0.2s, border-color 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.03)";
                e.currentTarget.style.borderColor = "#a8a29e";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "#d6d3d1";
              }}
            >
              Antwoord bewerken
            </button>
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
                color: "#8A8A8A",
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
                color: "#1A1A1A",
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
                borderRadius: "1rem",
                border: "2px solid #1A1A1A",
                background: "rgba(255, 255, 255, 0.5)",
                resize: "vertical",
                fontFamily: "inherit",
                fontSize: "1rem",
                lineHeight: 1.6,
                color: "#1A1A1A",
              }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              style={{
                marginTop: "1.5rem",
                ...COMMON_STYLES.pillButton,
                border: "none",
                background: "#002E5D",
                color: "#FFFFFF",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(26, 26, 26, 0.3)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              disabled={submitting}
            >
              {answer ? "Bijwerken" : "Versturen"}
            </button>
            {process.env.NODE_ENV === "development" && (
              <button
                type="button"
                onClick={() => {
                fireConfetti();
                setStreakOverlay(1);
              }}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.35rem 0.75rem",
                  fontSize: "0.75rem",
                  color: "#1A1A1A",
                  background: "transparent",
                  border: "1px dashed #1A1A1A",
                  borderRadius: "999px",
                  cursor: "pointer",
                  opacity: 0.7,
                }}
              >
                Test confetti
              </button>
            )}
          </div>
        )}
        {offline && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>
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
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={() => setShowEditConfirmation(false)}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "1.5rem",
              padding: "3rem 2rem",
              maxWidth: "24rem",
              width: "100%",
              textAlign: "center",
              animation: "streakEnter 0.3s ease-out",
              boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#1A1A1A",
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

// ============ CALENDAR VIEW ============
function CalendarView({ 
  registerCalendarUpdate,
  user
}: { 
  registerCalendarUpdate: (callback: (dayKey: string, questionText: string, answerText: string) => void) => void;
  user: any;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayYear, setDisplayYear] = useState(() => new Date().getFullYear());
  const [displayMonth, setDisplayMonth] = useState(() => new Date().getMonth());
  const [answersMap, setAnswersMap] = useState<
    Map<string, { questionText: string; answerText: string }>
  >(new Map());
  const [selectedDay, setSelectedDay] = useState<{
    day: string;
    questionText: string;
    answerText: string;
  } | null>(null);
  const [closingModal, setClosingModal] = useState(false);

  useEffect(() => {
    const updateFunction = (dayKey: string, questionText: string, answerText: string) => {
      setAnswersMap(prev => {
        const newMap = new Map(prev);
        newMap.set(dayKey, { questionText, answerText });
        return newMap;
      });
    };
    
    registerCalendarUpdate(updateFunction);
  }, [registerCalendarUpdate]);

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
          console.log('📅 Dev mode: Showing empty calendar (no database connection)');
          setAnswersMap(new Map());
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
        setAnswersMap(map);
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
          padding: "1.5rem",
          boxSizing: "border-box",
        }}
      >
        <p>Log in om je antwoorden te zien.</p>
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
          padding: "1.5rem",
          boxSizing: "border-box",
        }}
      >
        <p>Kalender laden…</p>
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
          padding: "1.5rem",
          boxSizing: "border-box",
        }}
      >
        <p>{error}</p>
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
  const todayKey = getLocalDayKey(new Date());

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

  const handleDayClick = (day: number) => {
    const dayKey = getLocalDayKey(new Date(displayYear, displayMonth, day));
    const entry = answersMap.get(dayKey);
    if (entry) {
      setSelectedDay({
        day: dayKey,
        questionText: entry.questionText,
        answerText: entry.answerText,
      });
    }
  };

  const handleCloseModal = () => {
    setClosingModal(true);
    setTimeout(() => {
      setSelectedDay(null);
      setClosingModal(false);
    }, 200); // Match animation duration
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
        background: "#F2F0EC",
      }}
    >
      <div 
        style={{ 
          padding: "0 1rem", 
          width: "100%", 
          boxSizing: "border-box",
          paddingTop: "clamp(1rem, 12vh, 5rem)",
          background: "#F2F0EC",
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
              color: "#1A1A1A",
            }}
          >
            ‹
          </button>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#1A1A1A" }}>
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
              color: "#1A1A1A",
            }}
          >
            ›
          </button>
        </div>

        <p
          style={{
            fontSize: "0.8125rem",
            color: "#6b7280",
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
                opacity: 0.8,
                padding: "0.5rem",
                color: "#1A1A1A",
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
            const dayKey = getLocalDayKey(new Date(displayYear, displayMonth, day));
            const hasAnswer = answersMap.has(dayKey);
            const isToday = dayKey === todayKey;
            const isFuture = dayKey > todayKey;

            const baseClasses =
              "aspect-square flex items-center justify-center rounded-full relative p-0 min-w-0 box-border transition-all duration-[180ms] text-[0.9375rem] font-medium";

            let cellClasses = baseClasses;
            if (isFuture) {
              cellClasses += " border border-gray-200 bg-transparent cursor-default text-gray-400 opacity-50";
            } else if (hasAnswer) {
              cellClasses +=
                " bg-emerald-200 text-gray-900 cursor-pointer hover:bg-emerald-300 border-none" +
                (isToday ? " ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#F2F0EC]" : "");
            } else {
              cellClasses +=
                " bg-transparent border border-gray-300 text-gray-700 cursor-default hover:border-gray-400" +
                (isToday ? " ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#F2F0EC]" : "");
            }

            return (
              <button
                key={day}
                type="button"
                onClick={() => hasAnswer && handleDayClick(day)}
                className={cellClasses}
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
            animation: closingModal ? "fadeOut 0.2s ease-out" : "fadeIn 0.2s ease-out",
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: "var(--background)",
              borderRadius: "1rem",
              padding: "1.5rem",
              maxWidth: "28rem",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
              animation: closingModal ? "scaleOut 0.2s ease-out" : "scaleIn 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
              {selectedDay.questionText}
            </h3>
            <p style={{ fontSize: "1rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
              {selectedDay.answerText}
            </p>
            <button
              type="button"
              onClick={handleCloseModal}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "999px",
                border: "none",
                backgroundColor: "var(--accent)",
                color: "#fff",
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Sluiten
            </button>
          </div>
        </div>
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
        padding: "1.5rem",
        width: "100%",
      }}
    >
      <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Instellingen</h2>

      <div style={{ marginBottom: "2rem" }}>
        {user && user.email && (
          <p style={{ fontSize: "0.9rem", opacity: 0.7, marginBottom: "1rem" }}>
            Ingelogd als: {user.email}
          </p>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "999px",
            border: "1px solid rgba(128, 128, 128, 0.3)",
            background: "transparent",
            color: "var(--foreground)",
            fontSize: "1rem",
            cursor: "pointer",
          }}
        >
          {signingOut ? "Bezig met uitloggen…" : "Uitloggen"}
        </button>
      </div>

      <div style={{ borderTop: "1px solid rgba(128, 128, 128, 0.2)", paddingTop: "1.5rem" }}>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          <strong>DailyQ</strong>
        </p>
        <p style={{ fontSize: "0.85rem", opacity: 0.6 }}>Versie 1.0</p>
        <p style={{ fontSize: "0.85rem", opacity: 0.6, marginTop: "0.5rem" }}>
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
            color: "#1A1A1A",
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
}) {
  const { supabase, userId, questionId, draft, dayKey, questionText, setAnswer, setStreakOverlay, onCalendarUpdate, onStreakUpdate, isEdit } =
    params;

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
