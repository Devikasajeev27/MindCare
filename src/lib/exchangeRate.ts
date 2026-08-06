import { FRONTEND_ENV } from "@/config";
const EXCHANGE_API_URL = `${FRONTEND_ENV.apiBase}/exchange-rates`;
const CACHE_KEY = "mindcare_exchange_rates";
const CACHE_EXPIRY = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

export interface ExchangeRates {
  [currencyCode: string]: number;
}

export interface CachedRates {
  rates: ExchangeRates;
  timestamp: number;
}

// Fallback rates from INR to other currencies
const FALLBACK_RATES: ExchangeRates = {
  INR: 1.0,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0094,
  AED: 0.044,
  JPY: 1.85,
  CAD: 0.016,
  SGD: 0.016,
  AUD: 0.018,
  SAR: 0.045,
  MYR: 0.056,
  CNY: 0.087,
  NZD: 0.02,
  CHF: 0.011
};

export const exchangeRateService = {
  async getRates(): Promise<ExchangeRates> {
    try {
      // 1. Check local storage cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed: CachedRates = JSON.parse(cached);
        const now = Date.now();
        if (now - parsed.timestamp < CACHE_EXPIRY) {
          return { ...FALLBACK_RATES, ...parsed.rates, INR: 1.0 };
        }
      }

      // 2. Fetch fresh rates from Frankfurter API
      const res = await fetch(EXCHANGE_API_URL);
      if (!res.ok) {
        throw new Error(`Failed to fetch exchange rates: ${res.statusText}`);
      }

      const data = await res.json();
      if (data && data.rates) {
        const freshRates: ExchangeRates = data.rates;
        const cacheData: CachedRates = {
          rates: freshRates,
          timestamp: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        return { ...FALLBACK_RATES, ...freshRates, INR: 1.0 };
      }

      throw new Error("Invalid response structure from exchange rate API");
    } catch (err) {
      console.warn("Using fallback exchange rates due to failure:", err);
      // Try to load expired cache first, then use hardcoded fallbacks
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed: CachedRates = JSON.parse(cached);
          return { ...FALLBACK_RATES, ...parsed.rates, INR: 1.0 };
        } catch {
          // ignore
        }
      }
      return FALLBACK_RATES;
    }
  }
};
