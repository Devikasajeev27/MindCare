export const EXCHANGE_RATE_CONFIG = {
  exchangeApiUrl: "https://api.frankfurter.app/latest?from=INR",
  cacheKey: "mindcare_exchange_rates",
  cacheExpiryMs: 4 * 60 * 60 * 1000, // 4 hours
  fallbackRates: {
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
    CHF: 0.011,
  } as Record<string, number>,
};

