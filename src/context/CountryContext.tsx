import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { api } from "@/lib/api";

import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  type CountryDetails,
  COUNTRY_STORAGE_KEY,
} from "@/config";

// Re-export for compatibility (no UI change)
export type { CountryDetails };
export { COUNTRIES, DEFAULT_COUNTRY };


interface CountryContextType {
  currentCountry: CountryDetails;
  setCountryByCode: (code: string) => Promise<void>;
  countries: CountryDetails[];
  isLoading: boolean;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

// Timezone to country code lookup helper
function detectCountryByTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return "";

    if (tz.includes("Kolkata") || tz.includes("Calcutta")) return "IN";
    if (tz.includes("London")) return "GB";
    if (tz.includes("Tokyo")) return "JP";
    if (tz.includes("Dubai")) return "AE";
    if (tz.includes("Singapore")) return "SG";
    if (tz.includes("Riyadh")) return "SA";
    if (tz.includes("Kuala_Lumpur")) return "MY";
    if (tz.includes("Auckland")) return "NZ";
    if (tz.includes("Shanghai") || tz.includes("Urumqi")) return "CN";
    if (tz.includes("Zurich") || tz.includes("Zurich")) return "CH";
    
    if (tz.startsWith("America/")) {
      if (tz.includes("New_York") || tz.includes("Chicago") || tz.includes("Denver") || 
          tz.includes("Los_Angeles") || tz.includes("Phoenix") || tz.includes("Anchorage") || 
          tz.includes("Honolulu")) {
        return "US";
      }
      if (tz.includes("Toronto") || tz.includes("Vancouver") || tz.includes("Montreal") || 
          tz.includes("Edmonton") || tz.includes("Halifax")) {
        return "CA";
      }
    }

    if (tz.startsWith("Australia/")) return "AU";
    if (tz.startsWith("Europe/")) {
      if (tz.includes("Berlin")) return "DE";
      if (tz.includes("Paris")) return "FR";
      if (tz.includes("Rome")) return "IT";
      if (tz.includes("Madrid")) return "ES";
      if (tz.includes("Amsterdam")) return "NL";
    }
  } catch {
    // ignore
  }
  return "";
}

// Browser language code helper
function detectCountryByLocale(): string {
  try {
    const lang = navigator.language;
    if (lang && lang.includes("-")) {
      const parts = lang.split("-");
      if (parts[1]) {
        const code = parts[1].toUpperCase();
        if (COUNTRIES.some(c => c.code === code)) {
          return code;
        }
      }
    }
  } catch {
    // ignore
  }
  return "";
}

export function CountryProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile, isAuthenticated } = useAuth();
  const [currentCountry, setCurrentCountry] = useState<CountryDetails>(DEFAULT_COUNTRY);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Initial country detection
  useEffect(() => {
    function initializeCountry() {
      // Priority 1: Check localStorage cached selection
      const cached = localStorage.getItem(COUNTRY_STORAGE_KEY);

      if (cached) {
        const found = COUNTRIES.find(c => c.code === cached);
        if (found) {
          setCurrentCountry(found);
          setIsLoading(false);
          return;
        }
      }

      // Priority 2: Detect via timezone
      let code = detectCountryByTimezone();
      
      // Priority 3: Detect via browser locale
      if (!code) {
        code = detectCountryByLocale();
      }

      const detected = COUNTRIES.find(c => c.code === code) || DEFAULT_COUNTRY;
      setCurrentCountry(detected);
      localStorage.setItem(COUNTRY_STORAGE_KEY, detected.code);

      setIsLoading(false);
    }

    initializeCountry();
  }, []);

  // 2. Sync with user profile once user logs in
  useEffect(() => {
    if (user && user.countryCode) {
      const found = COUNTRIES.find(c => c.code === user.countryCode);
      if (found && found.code !== currentCountry.code) {
        setCurrentCountry(found);
        localStorage.setItem(COUNTRY_STORAGE_KEY, found.code);
      }
    }
  }, [user]);

  const setCountryByCode = async (code: string) => {
    const found = COUNTRIES.find(c => c.code === code);
    if (!found) return;

    setCurrentCountry(found);
    localStorage.setItem(COUNTRY_STORAGE_KEY, found.code);


    // If logged in, update MongoDB profile
    if (isAuthenticated && user) {
      try {
        await api.auth.updateProfile({
          country: found.name,
          countryCode: found.code,
          dialCode: found.dialCode,
          currency: found.currency,
          currencyCode: found.currencyCode,
          preferredLocale: found.locale
        });
        if (typeof updateProfile === 'function') {
          updateProfile({
            country: found.name,
            countryCode: found.code,
            dialCode: found.dialCode,
            currency: found.currency,
            currencyCode: found.currencyCode,
            preferredLocale: found.locale
          });
        }
      } catch (err) {
        console.error("Failed to sync country profile change to server:", err);
      }
    }
  };

  return (
    <CountryContext.Provider value={{ currentCountry, setCountryByCode, countries: COUNTRIES, isLoading }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (!context) {
    throw new Error("useCountry must be used within a CountryProvider");
  }
  return context;
}
