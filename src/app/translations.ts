export type Lang = "en" | "nl";

export const translations: Record<
  Lang,
  Record<string, string>
> = {
  en: {
    // Tabs
    tabs_today: "Today",
    tabs_calendar: "Calendar",
    tabs_settings: "Settings",
    // Common
    common_close: "Close",
    common_ok: "OK",
    common_cancel: "Cancel",
    // Loading
    loading: "Loading…",
    loading_question_today: "Loading today's question…",
    loading_question: "Loading question…",
    loading_calendar: "Loading calendar…",
    // Streak
    streak_popup_title: "Current streak:",
    streak_modal_yay: "Yay!",
    streak_modal_body: "You now have a streak of {count} {day}.",
    streak_modal_day: "day",
    streak_modal_days: "days",
    aria_show_streak: "Show streak",
    // Onboarding
    onboarding_email: "Email",
    onboarding_password: "Password",
    onboarding_sign_up: "Sign up",
    onboarding_sign_in: "Sign in",
    onboarding_signing_up: "Signing up…",
    onboarding_signing_in: "Signing in…",
    onboarding_toggle_sign_in: "Already have an account? Sign in",
    onboarding_toggle_sign_up: "No account yet? Sign up",
    // Monday recap
    recap_body: "You answered {count} of the {total} questions last week.",
    recap_mooi: "Nice",
    recap_answer_missed: "Answer a missed day",
    // Today view
    today_ready: "Ready for today",
    today_edit_answer: "Edit answer",
    today_submit: "Submit",
    today_update: "Update",
    today_placeholder: "Type your answer…",
    today_no_question: "There is no question for today.",
    today_question_label: "Today's question",
    today_submit_error: "Your answer could not be sent. Please try again.",
    today_login_to_submit: "Log in to send an answer.",
    today_answer_changed: "Answer changed",
    // Missed day modal
    missed_title: "You missed this day",
    missed_prompt: "Do you want to answer it now?",
    missed_answer_now: "Answer now",
    // Closed day modal
    closed_title: "This day is closed",
    closed_body: "You can only answer questions from the last 7 days.",
    // Missed day answer modal
    missed_answer_question_label: "Question for that day",
    missed_answer_submitting: "Submitting…",
    missed_answer_error_load: "Question could not be loaded.",
    missed_answer_error_none: "No question available for this day.",
    missed_answer_error_generic: "Something went wrong.",
    missed_answer_error_before_account: "This date is before your account start.",
    missed_answer_error_outside_window: "This date is outside the 7-day window.",
    missed_answer_error_save: "Save failed.",
    // Calendar
    calendar_prev: "Previous",
    calendar_next: "Next",
    calendar_login_prompt: "Log in to see your answers.",
    calendar_error_load: "Answers for this month could not be loaded.",
    calendar_answered_this_month: "{captured} / {total} questions answered this month",
    calendar_view_answer_close: "Close",
    // Settings
    settings_title: "Settings",
    settings_signed_in_as: "Signed in as:",
    settings_sign_out: "Sign out",
    settings_signing_out: "Signing out…",
    settings_version: "Version 1.2",
    settings_tagline: "One question a day.",
    settings_language: "Language",
    settings_lang_en: "English",
    settings_lang_nl: "Dutch",
  },
  nl: {
    tabs_today: "Vandaag",
    tabs_calendar: "Kalender",
    tabs_settings: "Instellingen",
    common_close: "Sluiten",
    common_ok: "OK",
    common_cancel: "Annuleren",
    loading: "Laden…",
    loading_question_today: "Vraag van vandaag laden…",
    loading_question: "Vraag laden…",
    loading_calendar: "Kalender laden…",
    streak_popup_title: "Huidige streak:",
    streak_modal_yay: "Yay!",
    streak_modal_body: "Je hebt nu een streak van {count} {day}.",
    streak_modal_day: "dag",
    streak_modal_days: "dagen",
    aria_show_streak: "Toon streak",
    onboarding_email: "Email",
    onboarding_password: "Wachtwoord",
    onboarding_sign_up: "Registreren",
    onboarding_sign_in: "Inloggen",
    onboarding_signing_up: "Bezig met registreren…",
    onboarding_signing_in: "Bezig met inloggen…",
    onboarding_toggle_sign_in: "Heb je al een account? Log in",
    onboarding_toggle_sign_up: "Nog geen account? Registreer",
    recap_body: "Je hebt {count} van de {total} vragen vorige week beantwoord.",
    recap_mooi: "Mooi",
    recap_answer_missed: "Beantwoord een gemiste dag",
    today_ready: "Klaar voor vandaag",
    today_edit_answer: "Antwoord bewerken",
    today_submit: "Versturen",
    today_update: "Bijwerken",
    today_placeholder: "Typ je antwoord…",
    today_no_question: "Er staat geen vraag voor vandaag.",
    today_question_label: "Vraag van vandaag",
    today_submit_error: "Je antwoord kon niet worden verstuurd. Probeer het opnieuw.",
    today_login_to_submit: "Log in om een antwoord te versturen.",
    today_answer_changed: "Antwoord gewijzigd",
    missed_title: "Je hebt deze dag gemist",
    missed_prompt: "Wil je die nu alsnog beantwoorden?",
    missed_answer_now: "Nu beantwoorden",
    closed_title: "Deze dag is gesloten",
    closed_body: "Je kunt alleen vragen van de afgelopen 7 dagen beantwoorden.",
    missed_answer_question_label: "Vraag van die dag",
    missed_answer_submitting: "Bezig…",
    missed_answer_error_load: "Vraag kon niet worden geladen.",
    missed_answer_error_none: "Geen vraag beschikbaar voor deze dag.",
    missed_answer_error_generic: "Er ging iets mis.",
    missed_answer_error_before_account: "Deze datum is vóór het begin van je account.",
    missed_answer_error_outside_window: "Deze datum valt buiten de 7-dagen periode.",
    missed_answer_error_save: "Opslaan mislukt.",
    calendar_prev: "Vorige",
    calendar_next: "Volgende",
    calendar_login_prompt: "Log in om je antwoorden te zien.",
    calendar_error_load: "Antwoorden voor deze maand konden niet worden geladen.",
    calendar_answered_this_month: "{captured} / {total} vragen beantwoord deze maand",
    calendar_view_answer_close: "Sluiten",
    settings_title: "Instellingen",
    settings_signed_in_as: "Ingelogd als:",
    settings_sign_out: "Uitloggen",
    settings_signing_out: "Bezig met uitloggen…",
    settings_version: "Versie 1.2",
    settings_tagline: "One question a day.",
    settings_language: "Taal",
    settings_lang_en: "English",
    settings_lang_nl: "Nederlands",
  },
};

const LANG_STORAGE_KEY = "dailyq-lang";

export function getStoredLanguage(): Lang {
  if (typeof window === "undefined") return "nl";
  const stored = localStorage.getItem(LANG_STORAGE_KEY) as Lang | null;
  return stored === "en" || stored === "nl" ? stored : "nl";
}

export function setStoredLanguage(lang: Lang): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  }
}

export function t(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>
): string {
  let str = translations[lang][key] ?? translations.nl[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    });
  }
  return str;
}
