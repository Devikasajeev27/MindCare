# MindCare

## Multilingual safety gateway

Every AI chat message and every voice transcript passes through `server/src/services/safetyGateway.ts` before the normal cognitive response pipeline. The gateway performs two independent server-side checks:

1. `analyzeLanguageAndMeaning()` identifies language, script, transliteration, code-switching, preferred reply language, and an internal English interpretation.
2. `assessSelfHarmRisk()` evaluates the original wording with recent relevant messages and the user's country context.

The gateway returns structured data only. The response pipeline routes medium risk to a direct safety check-in and high/imminent risk to the crisis-safe flow. The browser never receives an AI key. Provider failures fall back to conservative local checks rather than preventing support.

Set these environment variables in the server environment:

- `GEMINI_API_KEY`: provider key used only by the backend.
- `GEMINI_MODEL`: normal generation model; defaults to `gemini-3.6-flash`.
- `SAFETY_GATEWAY_MODEL`: optional model override for the two safety checks.
- `DISTRESS_WINDOW_MINUTES`: continuous-distress window, default `10`.
- `DISTRESS_HIGH_COUNT`: number of moderate-or-higher events before a therapist session is opened, default `5`.

Country-specific resources belong in the crisis response policy. India uses emergency `112` and Tele-MANAS `14416` / `1-800-891-4416`; unknown countries are prompted to use local emergency services or a trusted person without guessing a number.

The continuous-distress workflow opens an assigned therapist emergency session. It does not notify a trusted person, family member, police, or emergency service automatically; those actions require a clear user action in the interface.

Run verification with:

```bash
npm run typecheck
npm run build
```
