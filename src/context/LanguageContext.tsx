import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getStoredItem, setStoredItem } from "@/lib/storage";

import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  type Lang,
  CRISIS_RESPONSES_I18N,
  AI_GREETINGS,
  AI_RESPONSES_I18N,
  LANGUAGE_STORAGE_KEY,
} from "@/config";

export type { Lang };

interface LangCtx {
  lang: Lang;
  setLang: (lang: Lang) => void;
  isRTL: boolean;
}

// Re-export constants for compatibility (no UI change)
export { LANGUAGES, AI_GREETINGS, AI_RESPONSES_I18N, CRISIS_RESPONSES_I18N }; // eslint-disable-line import/prefer-default-export



const LanguageContext = createContext<LangCtx>({
  lang: DEFAULT_LANGUAGE,
  setLang: () => undefined,
  isRTL: false,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => getStoredItem<Lang>(LANGUAGE_STORAGE_KEY, DEFAULT_LANGUAGE));
  const isRTL = LANGUAGES.find((language) => language.code === lang)?.rtl ?? false;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    setStoredItem(LANGUAGE_STORAGE_KEY, lang);
  }, [isRTL, lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      isRTL,
    }),
    [isRTL, lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLang = () => useContext(LanguageContext);

