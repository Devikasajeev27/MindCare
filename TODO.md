# TODO - Remove hardcoded values (no UI/theme change)

## Plan summary
- Introduce frontend config modules under `src/config/` for runtime constants (API URLs, storage keys, i18n/language/country/currency/exchange rate config).
- Refactor existing logic to import from config modules.
- Move seed/demo data into `server/src/config/seedData.ts` and move demo password into env/config.
- Refactor server CORS/proxy/environment values to use env/config with identical defaults.
- Keep `src/index.css` theme literals untouched.

## Steps
- [ ] Create frontend config files in `src/config/`.
- [ ] Refactor `src/lib/api.ts` to remove hardcoded API/storage/defaults.
- [ ] Refactor `src/context/LanguageContext.tsx` to remove hardcoded language metadata/messages/storage keys.
- [ ] Refactor `src/context/CountryContext.tsx` to import country list & defaults from config.
- [ ] Refactor `src/context/CurrencyContext.tsx` (interval and initial rates) to import from config.
- [x] Refactor `src/context/ThemeContext.tsx` to remove hardcoded storage key/default.

- [ ] Refactor `src/lib/exchangeRate.ts` to move external URL/cache/fallbacks into config.
- [x] Refactor `vite.config.ts` to use env/config for proxy target & ports (preserve defaults).
- [x] Create server config files if needed and refactor `server/src/config/db.ts`.
- [ ] Move seed literals to `server/src/config/seedData.ts` and refactor `server/src/config/seed.ts`.
- [x] Refactor `server/src/index.ts` CORS origins to use env/config with identical defaults.
- [x] Add `.env.example` (optional) documenting required env vars.
- [x] Run `npm run typecheck` and `npm run build`.
- [ ] Run `npm run dev` and verify key flows (login, language/country/currency, exchange rates, crisis/help text, demo seed login).
