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
  white: '#eee9e0',
} as const;

const GRADIENTS = {
  horizontal: `linear-gradient(to right, ${COLORS.primary}, ${COLORS.secondary})`,
  vertical: `linear-gradient(to bottom, #eee9e0, #E5E5CD, #DFDFCD)`,
} as const;

const COMMON_STYLES = {
  pillButton: {
    borderRadius: '999px',
    padding: '1rem 2rem',
  },
  primaryBorder: `2px solid ${COLORS.primary}`,
} as const;

// Mock user for development
const DEV_MOCK_USER = {
  id: 'dev-user-id',
  email: 'dev@localhost',
  aud: 'authenticated',
  role: 'authenticated',
} as const;

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
          console.log('👤 No user found - creating dev mock user');
          setUser({
            ...DEV_MOCK_USER,
            created_at: new Date().toISOString(),
          });
        } else {
          setUser(u);
        }
        setCheckingAuth(false);

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          console.log('🔄 Auth state changed:', _event);
          // In development, keep mock user when session is null so submit still works
          if (process.env.NODE_ENV === "development" && !session?.user) {
            setUser({ ...DEV_MOCK_USER, created_at: new Date().toISOString() });
          } else {
            setUser(session?.user ?? null);
          }
          setCheckingAuth(false);
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (authError) {
        // If Supabase fails to initialize, use mock user immediately
        console.warn('⚠️ Supabase auth failed, using mock user for development');
        console.error('Auth error:', authError);
        
        setUser({
          ...DEV_MOCK_USER,
          created_at: new Date().toISOString(),
        });
        setCheckingAuth(false);
      }
    };

    const cleanup = initAuth();
    return () => {
      cleanup?.then(fn => fn?.());
    };
  }, []);

  const loadCurrentStreak = async () => {
    if (!user) return;
    
    try {
      const supabase = createSupabaseBrowserClient();
      const today = new Date();
      const dayKey = getLocalDayKey(today);
      
      const streak = await computeStreak({ supabase, userId: user.id, dayKey });
      setCurrentStreak(streak);
    } catch (e) {
      console.error('Failed to load streak:', e);
      setCurrentStreak(0);
    }
  };

  useEffect(() => {
    if (user && user.id !== 'dev-user-id') {
      loadCurrentStreak();
    } else {
      setCurrentStreak(0);
    }
  }, [user]);

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
        <p>Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <OnboardingScreen />;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        maxHeight: "100dvh",
        background: "#eee9e0",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgba(128, 128, 128, 0.2)",
          background: "#eee9e0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 
          style={{ 
            fontSize: "1.25rem", 
            fontWeight: 600, 
            margin: 0,
            color: "#1A1A1A",
          }}
        >
          DailyQ
        </h2>
        
        {activeTab === "today" && (
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#1A1A1A",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            Streak: {currentStreak}
          </span>
        )}
        
        {activeTab === "today" && (
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#1A1A1A",
              opacity: 0.7,
            }}
          >
            {new Date().toLocaleDateString("en-US", { 
              weekday: "short", 
              month: "short", 
              day: "numeric" 
            })}
          </span>
        )}
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
          <TodayView onCalendarUpdate={onCalendarUpdate} onStreakUpdate={setCurrentStreak} />
        </div>
        <div
          style={{
            display: activeTab === "calendar" ? "flex" : "none",
            height: "100%",
            width: "100%",
          }}
        >
          <CalendarView registerCalendarUpdate={setOnCalendarUpdate} user={user} />
        </div>
        <div
          style={{
            display: activeTab === "settings" ? "flex" : "none",
            height: "100%",
          }}
        >
          <SettingsView user={user} />
        </div>
      </main>

      {/* Tab bar */}
      <nav
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-evenly",
          alignItems: "center",
          background: "#eee9e0",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0, 0, 0, 0.08)",
          paddingTop: "12px",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          marginLeft: "12px",
          marginRight: "12px",
          marginBottom: 0,
          marginTop: "-12px",
        }}
      >
        <TabButton
          active={activeTab === "today"}
          onClick={() => setActiveTab("today")}
          label="Today"
          icon={<QuestionMarkIcon />}
        />
        <TabButton
          active={activeTab === "calendar"}
          onClick={() => setActiveTab("calendar")}
          label="Calendar"
          icon={<CalendarIcon />}
        />
        <TabButton
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
          label="Settings"
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
      const errorMessage = e?.message || "Authentication failed. Please try again.";
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
              color: "#eee9e0",
              fontWeight: 600,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting || !email.trim() || !password.trim() ? 0.6 : 1,
              transition: "all 0.2s",
              marginBottom: "1rem",
            }}
          >
            {submitting ? (isSignUp ? "Signing up…" : "Signing in…") : (isSignUp ? "Sign Up" : "Sign In")}
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
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
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
      colors: ["#1A1A1A", "#eee9e0", "#c4b89a"],
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
          backgroundColor: "#eee9e0",
          borderRadius: "1.5rem",
          padding: "3rem 2rem",
          maxWidth: "24rem",
          width: "100%",
          textAlign: "center",
          animation: "streakEnter 0.3s ease-out",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
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
          Yay.
        </p>
        <p
          style={{
            fontSize: "1.25rem",
            color: "#1A1A1A",
            marginBottom: "2rem",
          }}
        >
          This is your {streak}-day streak.
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "0.75rem 2rem",
            borderRadius: "999px",
            border: "none",
            backgroundColor: "#1A1A1A",
            color: "#eee9e0",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ============ TODAY VIEW ============
function TodayView({ 
  onCalendarUpdate,
  onStreakUpdate
}: { 
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
        
        // Check if we're using mock user - if so, skip database entirely
        let currentUser = null;
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: { user } } = await supabase.auth.getUser();
          currentUser = user;
        } catch (e) {
          console.warn('⚠️ Could not get user, will use mock data');
        }

        // If mock user, use mock data immediately (no database queries)
        if (currentUser?.id === 'dev-user-id') {
          console.log('👤 Mock user detected - using mock question immediately');
          setQuestion({
            id: 'dev-question-id',
            text: 'What made you smile today?',
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
            text: 'What made you smile today?',
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
        if (currentUser && currentUser.id !== 'dev-user-id') {
          try {
            console.log('📝 Checking for existing answer...');
            
            const supabase = createSupabaseBrowserClient();
            const {
              data: answerData,
              error: answerError,
            } = await supabase
              .from("answers")
              .select("id, answer_text")
              .eq("user_id", currentUser.id)
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
        setError("Something went wrong loading today's question.");
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
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const today = new Date();
      const dayKey = getLocalDayKey(today);

      if (!user) {
        setError("You must be signed in to submit an answer.");
        setSubmitting(false);
        return;
      }

      // Check if we're editing an existing answer
      const editingExisting = !!answer;

      // In development with mock user, simulate success without database
      if (process.env.NODE_ENV === 'development' && user.id === 'dev-user-id') {
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
        await saveAnswerAndStreak({
          supabase,
          userId: user.id,
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
        
        if (editingExisting) {
          setShowEditConfirmation(true);
          setTimeout(() => setShowEditConfirmation(false), 2000);
        }
        
        setDraft(''); // Clear draft after successful submission
        setIsEditMode(false); // Exit edit mode
        console.log('✅ Real user submission complete - answer set, draft cleared, edit mode off');
      }
    } catch (e) {
      setError("Could not submit your answer. Please try again.");
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
        <p>Loading today's question…</p>
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
        <p>No question is configured for today.</p>
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
        backgroundColor: "#eee9e0",
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <section style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <h1 
          style={{ 
            fontSize: "2rem",
            fontWeight: 600,
            textAlign: "center",
            marginBottom: "2.5rem",
            marginTop: "clamp(1rem, 15vh, 6rem)",
            color: "#1A1A1A",
            lineHeight: 1.3,
          }}
        >
          {question.text}
        </h1>
        {answer && !isEditMode ? (
          <div style={{ 
            flex: 1, 
            display: "flex", 
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem"
          }}>
            <p style={{
              fontSize: "1.125rem",
              color: "#1A1A1A",
              textAlign: "center",
              fontWeight: 500,
            }}>
              Nice! You've answered today's question.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsEditMode(true);
                setDraft(answer.answer_text);
              }}
              style={{
                ...COMMON_STYLES.pillButton,
                border: "2px solid #1A1A1A",
                background: "#eee9e0",
                color: "#1A1A1A",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Edit Answer
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your answer…"
              style={{
                flex: 1,
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
                color: "#eee9e0",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(26, 26, 26, 0.3)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              disabled={submitting}
            >
              {answer ? "Update" : "Submit"}
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
          </>
        )}
        {offline && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>
            You are offline. Your answer will sync when you're back online.
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
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#1A1A1A",
            color: "#eee9e0",
            padding: "1rem 2rem",
            borderRadius: "999px",
            fontSize: "1rem",
            fontWeight: 600,
            zIndex: 2000,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          Answer changed
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
        if (process.env.NODE_ENV === 'development' && user.id === 'dev-user-id') {
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
        setError("Could not load answers for this month.");
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
        <p>Sign in to see your answers.</p>
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
        <p>Loading calendar…</p>
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
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
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
        background: "#eee9e0",
      }}
    >
      <div 
        style={{ 
          padding: "0 1rem", 
          width: "100%", 
          boxSizing: "border-box",
          paddingTop: "clamp(1rem, 12vh, 5rem)",
          background: "#eee9e0",
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "0.75rem",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dow) => (
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
            return (
              <button
                key={day}
                type="button"
                onClick={() => hasAnswer && handleDayClick(day)}
                style={{
                  aspectRatio: "1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(26, 26, 26, 0.3)",
                  borderRadius: "0.5rem",
                  background: "transparent",
                  cursor: hasAnswer ? "pointer" : "default",
                  position: "relative",
                  color: "#1A1A1A",
                  padding: "0.25rem",
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <span style={{ fontSize: "1rem", fontWeight: 500 }}>{day}</span>
                {hasAnswer && (
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      backgroundColor: "#1A1A1A",
                      marginTop: "4px",
                    }}
                  />
                )}
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
              Close
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
      <h2 style={{ fontSize: "1.5rem", marginBottom: "1.5rem" }}>Settings</h2>

      <div style={{ marginBottom: "2rem" }}>
        {user && user.email && (
          <p style={{ fontSize: "0.9rem", opacity: 0.7, marginBottom: "1rem" }}>
            Signed in as: {user.email}
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
          {signingOut ? "Logging out…" : "Log Out"}
        </button>
      </div>

      <div style={{ borderTop: "1px solid rgba(128, 128, 128, 0.2)", paddingTop: "1.5rem" }}>
        <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
          <strong>DailyQ</strong>
        </p>
        <p style={{ fontSize: "0.85rem", opacity: 0.6 }}>Version 1.0</p>
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
