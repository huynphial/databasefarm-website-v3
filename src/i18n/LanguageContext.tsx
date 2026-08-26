import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import en from './locales/en.json';
import vi from './locales/vi.json';

export type LanguageCode = 'en' | 'vi';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
];

const dictionaries: Record<LanguageCode, any> = {
  en,
  vi,
};

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  availableLanguages: LanguageOption[];
  t: (key: string, params?: Record<string, string | number>) => string;
  currentDictionary: any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'app_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'vi')) {
        return saved as LanguageCode;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'en';
  });

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore
    }
  };

  const t = useCallback(
    (keyPath: string, params?: Record<string, string | number>): string => {
      const keys = keyPath.split('.');
      let current: any = dictionaries[language] || dictionaries.en;
      let fallback: any = dictionaries.en;

      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          current = undefined;
        }

        if (fallback && typeof fallback === 'object' && key in fallback) {
          fallback = fallback[key];
        } else {
          fallback = undefined;
        }
      }

      let result = typeof current === 'string' ? current : typeof fallback === 'string' ? fallback : keyPath;

      if (params && typeof result === 'string') {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          result = result.replace(new RegExp(`{{${paramKey}}}|{${paramKey}}`, 'g'), String(paramVal));
        });
      }

      return result;
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        availableLanguages: AVAILABLE_LANGUAGES,
        t,
        currentDictionary: dictionaries[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  return { t, language, setLanguage, availableLanguages };
};
