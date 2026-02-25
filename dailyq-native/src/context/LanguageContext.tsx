"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Lang } from "../i18n/translations";
import {
  getStoredLanguage,
  setStoredLanguage,
  t as translate,
} from "../i18n/translations";

const LANG_STORAGE_KEY = "dailyq-lang";

type TFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

export type FormatDateOptions = Intl.DateTimeFormatOptions;

function safeFormatDate(
  value: Date | string | number | null | undefined,
  lang: Lang,
  options?: FormatDateOptions
): string {
  if (value == null) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const locale = lang === "nl" ? "nl-NL" : "en-US";
  return new Intl.DateTimeFormat(locale, options).format(date);
}

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
  /** Formats a date for display. Returns "" if the date is invalid or not yet available. */
  formatDate: (
    value: Date | string | number | null | undefined,
    options?: FormatDateOptions
  ) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({
  children,
  initialLang = "nl",
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    getStoredLanguage().then((stored) => setLangState(stored));
  }, []);

  useEffect(() => {
    setStoredLanguage(lang);
  }, [lang]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
  }, []);

  const t = useCallback<TFunction>(
    (key, params) => translate(lang, key, params),
    [lang]
  );

  const formatDate = useCallback<LanguageContextValue["formatDate"]>(
    (value, options) => safeFormatDate(value, lang, options),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, formatDate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
}
