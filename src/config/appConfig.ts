export const APP_CONFIG = {
  frontend: {
    tokenStorageKey: "mindcare_token",
  },
  defaults: {
    language: {
      storageKey: "mc_lang",
      code: "en",
    },
    theme: {
      storageKey: "mc_theme",
      code: "light",
    },
    recipient: "ai" as const,
  },
};

