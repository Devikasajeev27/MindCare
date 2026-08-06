export type CountryCode = string;

export interface CountryDetails {
  name: string;
  code: CountryCode; // ISO 2-letter
  dialCode: string;
  currency: string;
  currencyCode: string;
  locale: string;
}

export const COUNTRIES: CountryDetails[] = [
  { name: "India", code: "IN", dialCode: "+91", currency: "Indian Rupee", currencyCode: "INR", locale: "en-IN" },
  { name: "United States", code: "US", dialCode: "+1", currency: "US Dollar", currencyCode: "USD", locale: "en-US" },
  { name: "United Kingdom", code: "GB", dialCode: "+44", currency: "British Pound", currencyCode: "GBP", locale: "en-GB" },
  { name: "United Arab Emirates", code: "AE", dialCode: "+971", currency: "UAE Dirham", currencyCode: "AED", locale: "ar-AE" },
  { name: "Japan", code: "JP", dialCode: "+81", currency: "Japanese Yen", currencyCode: "JPY", locale: "ja-JP" },
  { name: "Canada", code: "CA", dialCode: "+1", currency: "Canadian Dollar", currencyCode: "CAD", locale: "en-CA" },
  { name: "Singapore", code: "SG", dialCode: "+65", currency: "Singapore Dollar", currencyCode: "SGD", locale: "en-SG" },
  { name: "Australia", code: "AU", dialCode: "+61", currency: "Australian Dollar", currencyCode: "AUD", locale: "en-AU" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", currency: "Saudi Riyal", currencyCode: "SAR", locale: "ar-SA" },
  { name: "Malaysia", code: "MY", dialCode: "+60", currency: "Malaysian Ringgit", currencyCode: "MYR", locale: "ms-MY" },
  { name: "Germany", code: "DE", dialCode: "+49", currency: "Euro", currencyCode: "EUR", locale: "de-DE" },
  { name: "France", code: "FR", dialCode: "+33", currency: "Euro", currencyCode: "EUR", locale: "fr-FR" },
  { name: "Spain", code: "ES", dialCode: "+34", currency: "Euro", currencyCode: "EUR", locale: "es-ES" },
  { name: "Italy", code: "IT", dialCode: "+39", currency: "Euro", currencyCode: "EUR", locale: "it-IT" },
  { name: "Netherlands", code: "NL", dialCode: "+31", currency: "Euro", currencyCode: "EUR", locale: "nl-NL" },
  { name: "Switzerland", code: "CH", dialCode: "+41", currency: "Swiss Franc", currencyCode: "CHF", locale: "de-CH" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", currency: "New Zealand Dollar", currencyCode: "NZD", locale: "en-NZ" },
  { name: "China", code: "CN", dialCode: "+86", currency: "Chinese Yuan", currencyCode: "CNY", locale: "zh-CN" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India

export const COUNTRY_STORAGE_KEY = "mindcare_selected_country";

