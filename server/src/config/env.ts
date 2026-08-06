const DEFAULT_CLIENT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
];

function splitCsv(value: string | undefined, fallback: string[]) {
  if (!value) return fallback;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : fallback;
}

// ── Startup validation ───────────────────────────────────────────────────────
// Collect all missing required env vars and report them all at once.
const missingVars: string[] = [];

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  missingVars.push(key);
  return "";
}

const jwtSecret = requireEnv("JWT_SECRET", "supersecretjwtkey123_dev_only");
const mongoUri  = requireEnv("MONGODB_URI", "mongodb://127.0.0.1:27017/mindcare");
const port      = Number(process.env.API_PORT || process.env.PORT || 5000);
const clientOrigins = splitCsv(process.env.CLIENT_ORIGINS, DEFAULT_CLIENT_ORIGINS);

// In production, JWT_SECRET and MONGODB_URI are required.
if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "supersecretjwtkey123_dev_only") {
    missingVars.push("JWT_SECRET (must be a secure secret in production)");
  }
  if (!process.env.MONGODB_URI) {
    missingVars.push("MONGODB_URI");
  }
}

if (missingVars.length > 0) {
  console.error("\n╔══════════════════════════════════════════════════════════╗");
  console.error("║            FATAL: Missing Required Environment Vars       ║");
  console.error("╚══════════════════════════════════════════════════════════╝");
  missingVars.forEach((v) => console.error(`  ✗  ${v}`));
  console.error("\nSet these in your .env file and restart the server.\n");
  process.exit(1);
}

export const serverConfig = {
  port,
  mongoUri,
  clientOrigins,
  jwtSecret,
  isProduction: process.env.NODE_ENV === "production",
};
