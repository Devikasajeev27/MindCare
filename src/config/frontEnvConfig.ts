const envBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const FRONTEND_ENV = {
  apiBase: envBase
    ? (envBase.endsWith("/api") ? envBase : `${envBase}/api`)
    : "https://mindcare-backend-5yrz.onrender.com/api",
};

