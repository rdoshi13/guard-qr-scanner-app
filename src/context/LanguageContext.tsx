import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import { Language } from "../i18n/strings";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const LANGUAGE_KEY = "app_language_v1";

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

function parseLanguage(value: string | null): Language {
  return value === "gu" ? "gu" : "en";
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<Language>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((value) => setLanguageState(parseLanguage(value)))
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage).catch(() => {});
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {hydrated ? children : null}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return ctx;
};
