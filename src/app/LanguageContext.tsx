"use client";

import { createContext, useContext, useCallback, useState, useEffect } from "react";
import {
  type Lang,
  getStoredLanguage,
  setStoredLanguage,
  t as translate,
} from "./translations";

type TFunction = (key: string, params?: Record<string, string | number>) => string;

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
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
    setLangState(getStoredLanguage());
  }, []);

  useEffect(() => {
    setStoredLanguage(lang);
  }, [lang]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
  }, []);

  const t = useCallback<TFunction>(
    (key, params) => translate(lang, key, params),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
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
