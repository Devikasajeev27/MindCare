import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useCountry } from "./CountryContext";
import { exchangeRateService, ExchangeRates } from "@/lib/exchangeRate";

interface CurrencyContextType {
  convert: (amountInINR: number) => number;
  format: (amountInINR: number) => string;
  currencyCode: string;
  isLoading: boolean;
  rates: ExchangeRates;
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { currentCountry } = useCountry();
  const [rates, setRates] = useState<ExchangeRates>({ INR: 1.0 });
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch live rates on mount
  const refreshRates = async () => {
    try {
      const freshRates = await exchangeRateService.getRates();
      setRates(freshRates);
    } catch (err) {
      console.error("Failed to load exchange rates in context:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshRates();

    // Auto refresh rates every 30 minutes
    const interval = setInterval(refreshRates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const currencyCode = currentCountry.currencyCode;
  const locale = currentCountry.locale;

  // Conversion: multiply by rate
  const convert = (amountInINR: number): number => {
    if (amountInINR === 0) return 0;
    const rate = rates[currencyCode];
    if (rate === undefined) return amountInINR; // fallback to INR
    return amountInINR * rate;
  };

  // Formatting: use Intl.NumberFormat
  const format = (amountInINR: number): string => {
    const converted = convert(amountInINR);
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: currencyCode === "JPY" ? 0 : 2,
        maximumFractionDigits: currencyCode === "JPY" ? 0 : 2
      }).format(converted);
    } catch (err) {
      console.warn("Intl.NumberFormat error, falling back to simple format:", err);
      // Fallback
      return `${currencyCode} ${converted.toFixed(2)}`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ convert, format, currencyCode, isLoading, rates, refreshRates }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
