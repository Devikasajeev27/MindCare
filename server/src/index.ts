// ── Load env vars FIRST, before any other import that reads them ───────────── (Therapist shift availability dropdown time pickers & MongoDB persistence complete)
import dotenv from "dotenv";
dotenv.config();

import path from "path";
import fs from "fs";
import mongoose from "mongoose";
// Trigger tsx watch restart
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { connectDB, stopMemoryServerIfRunning } from "./config/db.ts";
import { ensureFixedRoleDemoData } from "./seeders/fixedRoleDemoSeeder.ts";
import apiRoutes from "./routes/apiRoutes.ts";
import { serverConfig } from "./config/env.ts";
import { createServer } from "http";
import { initSocketServer } from "./services/socketService.ts";
import { initCronJobs } from "./services/cronService.ts";
import { sanitize } from "./middleware/sanitize.ts";
import { sendResponse } from "./utils/response.ts";

const app = express();

// ── Request ID Middleware ──────────────────────────────────────────────────
app.use((req: any, res: Response, next: NextFunction) => {
  req.requestId = Math.random().toString(36).substring(2, 15);
  next();
});

// ── Security Middlewares ────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin.endsWith(".vercel.app") ||
        origin.includes("vercel.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        serverConfig.clientOrigins.includes(origin) ||
        process.env.CLIENT_ORIGINS === "*"
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    exposedHeaders: ["x-rtb-fingerprint-id", "request-id", "Content-Range", "X-Total-Count"],
  })
);

// ── Rate Limiting ───────────────────────────────────────────────────────────
const isProd = serverConfig.isProduction;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 999999,
  message: { message: "Too many requests from this IP, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 999999,
  message: { message: "Too many authentication attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 1000 : 999999,
  message: { message: "Too many admin requests, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/admin", adminLimiter);
app.use("/api", limiter);

// ── Request Parsing + Sanitization ─────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(sanitize);

// ── Health, Liveness, Readiness Checks ───────────────────────────────────────
app.get("/api/live", (req: Request, res: Response) => {
  return sendResponse(res, 200, true, "Liveness probe success: server is running", {
    status: "UP",
    timestamp: new Date().toISOString()
  }, null, req);
});

app.get("/api/ready", (req: Request, res: Response) => {
  if (!_dbConnected) {
    return sendResponse(res, 503, false, "Readiness probe failed: database offline", {
      status: "DOWN",
      timestamp: new Date().toISOString()
    }, null, req);
  }
  return sendResponse(res, 200, true, "Readiness probe success: database is connected", {
    status: "UP",
    timestamp: new Date().toISOString()
  }, null, req);
});

app.get("/api/health", (req: Request, res: Response) => {
  const envStatus = {
    MONGO_URI: process.env.MONGODB_URI ? "configured" : "fallback",
    JWT_SECRET: process.env.JWT_SECRET ? "configured" : "fallback",
    PORT: process.env.PORT || process.env.API_PORT ? "configured" : "default"
  };

  const isGeminiConfigured = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy";

  return sendResponse(res, 200, true, "Health check completed", {
    status: _dbConnected ? "HEALTHY" : "DEGRADED",
    uptime: process.uptime(),
    db: _dbConnected ? "connected" : "disconnected",
    gemini: isGeminiConfigured ? "ready" : "offline",
    environment: envStatus,
    timestamp: new Date().toISOString()
  }, null, req);
});

// ── DB readiness gate ────────────────────────────────────────────────────────
// This flag is flipped to true once MongoDB connects successfully.
// The middleware below is registered BEFORE the API routes so every request
// to /api/* gets a clear 503 + actionable message when DB is unavailable.
let _dbConnected = false;

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  // Always allow the health check probes through
  if (["/health", "/ready", "/live"].includes(req.path)) return next();
  if (!_dbConnected) {
    return res.status(503).json({
      message:
        "Database not connected. Start the server with MongoDB running, or install " +
        "mongodb-memory-server (npm install --save-dev mongodb-memory-server) and restart.",
    });
  }
  next();
});

// Serve static uploads directory
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// ── API Routes ──────────────────────────────────────────────────────────────
app.use("/api", apiRoutes);

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error("━━━━━━━━━━━━━━━━━━━━━━ UNHANDLED ERROR ━━━━━━━━━━━━━━━━━━━━━━");
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  console.error(err?.stack || err);
  console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    fs.writeFileSync(
      path.join(process.cwd(), "server_error.txt"),
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}\nError: ${err?.message}\nStack: ${err?.stack || err}\n\n`,
      { flag: "a" }
    );
  } catch (e) {}

  const status = typeof err?.status === "number" ? err.status : 500;
  const message =
    serverConfig.isProduction
      ? "An unexpected error occurred. Please try again later."
      : err?.message || "Internal Server Error";

  return sendResponse(res, status, false, message, null, {
    stack: serverConfig.isProduction ? undefined : err?.stack,
  }, req);
});

// ── Startup: connect DB then start listening ──────────────────────────────────
async function bootstrap() {
  try {
    await connectDB();
    _dbConnected = true;
    console.log("✓ MongoDB ready — accepting requests");

    mongoose.connection.on("connected", () => { _dbConnected = true; });
    mongoose.connection.on("disconnected", () => { _dbConnected = false; });
    mongoose.connection.on("reconnected", () => { _dbConnected = true; });

    // Self-healing database correction for broken template Unsplash URLs
    try {
      const { Resource } = await import("./models/Resource.ts");
      const { Therapist } = await import("./models/Therapist.ts");
      const { User } = await import("./models/User.ts");

      const ACTIVE_UNSPLASH_URLS = [
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1528715471579-d1bcf0ba5e83?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&q=80&w=400",
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&q=80&w=400"
      ];

      const THERAPIST_AVATARS = [
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200",
        "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200",
        "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200",
        "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=200",
        "https://images.unsplash.com/photo-1591604021695-0c69b7c05981?auto=format&fit=crop&q=80&w=200"
      ];

      const badResources = await Resource.find({ image: /unsplash\.com\/photo-1506000000000/ });
      if (badResources.length > 0) {
        console.log(`[STARTUP-VALIDATION] Found ${badResources.length} resources with broken Unsplash template. Correcting...`);
        for (let i = 0; i < badResources.length; i++) {
          badResources[i].image = ACTIVE_UNSPLASH_URLS[i % ACTIVE_UNSPLASH_URLS.length];
          await badResources[i].save();
        }
      }

      const badUsers = await User.find({ avatar: /unsplash\.com\/photo-1500000000000/ });
      if (badUsers.length > 0) {
        console.log(`[STARTUP-VALIDATION] Found ${badUsers.length} user avatar entries with broken Unsplash template. Correcting...`);
        for (let i = 0; i < badUsers.length; i++) {
          badUsers[i].avatar = THERAPIST_AVATARS[i % THERAPIST_AVATARS.length];
          await badUsers[i].save();
        }
      }

      const therapistsListings = await Therapist.find({});
      for (let i = 0; i < therapistsListings.length; i++) {
        const associatedUser = await User.findById(therapistsListings[i].userId);
        if (associatedUser && associatedUser.avatar && (therapistsListings[i].avatar !== associatedUser.avatar || therapistsListings[i].avatar?.includes("1500000000000"))) {
          therapistsListings[i].avatar = associatedUser.avatar;
          await therapistsListings[i].save();
        }
      }
      console.log("[STARTUP-VALIDATION] Legacy image corrections completed successfully.");
    } catch (dbCorrectionErr: any) {
      console.error("[STARTUP-VALIDATION] Failed during database legacy image correction:", dbCorrectionErr.message);
    }

    // The fixed role demo accounts are the only startup-generated data.  The
    // seeder preserves existing role, email, password, and ObjectId values.
    await ensureFixedRoleDemoData();
    console.log("[STARTUP-VALIDATION] Fixed role demo data verified.");

    // Retain the documented environment switch without allowing the legacy
    // broad seeder to create unrelated placeholder accounts or records.
    if (process.env.RUN_SEED === "true") {
      await ensureFixedRoleDemoData();
      console.log("[STARTUP-INFO] Fixed role demo data ensured (RUN_SEED=true).");
    } else {
      console.log("[STARTUP-INFO] Fixed role demo data ensured. Use npm run seed:demo-roles for an explicit seed run.");
    }

    // In-process verification of Daily Streak reset & recovery alerts
    if (process.env.RUN_STREAK_DEBUG === "true") (async () => {
      try {
        console.log("[DEBUG-STREAKS] Starting Wellness daily streak verification...");
        const { User } = await import("./models/User.ts");
        const { Notification } = await import("./models/Notification.ts");
        
        // 1. Seed test users
        let testUser1 = await User.findOne({ email: "user1@example.com" });
        if (!testUser1) {
          testUser1 = await User.create({
            name: "Test Streak User 1",
            email: "user1@example.com",
            password: "password123",
            role: "user",
            streak: 5,
            lastActivityDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            country: "India",
            countryCode: "IN",
            dialCode: "+91",
            phoneNumber: "+919900000001",
            currency: "Indian Rupee",
            currencyCode: "INR",
            preferredLocale: "en-IN"
          });
        } else {
          testUser1.streak = 5;
          testUser1.lastActivityDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
          await testUser1.save();
        }

        let testUser2 = await User.findOne({ email: "user2@example.com" });
        if (!testUser2) {
          testUser2 = await User.create({
            name: "Test Streak User 2",
            email: "user2@example.com",
            password: "password123",
            role: "user",
            streak: 10,
            lastActivityDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            country: "India",
            countryCode: "IN",
            dialCode: "+91",
            phoneNumber: "+919900000002",
            currency: "Indian Rupee",
            currencyCode: "INR",
            preferredLocale: "en-IN"
          });
        } else {
          testUser2.streak = 10;
          testUser2.lastActivityDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
          await testUser2.save();
        }

        console.log("[DEBUG-STREAKS] Seeded users streak values. Executing streak check...");

        // 2. Run check logic
        const users = [testUser1, testUser2];
        const now = new Date();
        for (const u of users) {
          const freshUser = await User.findById(u._id);
          if (!freshUser) continue;
          
          const diffTime = Math.abs(now.getTime() - new Date(freshUser.lastActivityDate!).getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          console.log(`[DEBUG-STREAKS] Checking ${freshUser.name}: diffDays = ${diffDays}, current streak = ${freshUser.streak}`);

          if (diffDays > 1) {
            const oldStreak = freshUser.streak;
            freshUser.streak = 0;
            await freshUser.save();
            if (oldStreak > 0) {
              await Notification.create({
                userId: freshUser._id,
                title: "Oh no! Your streak has reset",
                message: `Your ${oldStreak}-day wellness streak has broken. Start a new journal or log your mood today to begin a new streak!`,
                type: "alert",
              });
              console.log(`[DEBUG-STREAKS] Created streak reset notification for ${freshUser.name}.`);
            }
          } else if (diffDays === 1) {
            await Notification.create({
              userId: freshUser._id,
              title: "Keep your streak going!",
              message: "You haven't recorded any activity today. Log your mood or write a quick journal to preserve your daily streak!",
              type: "info",
            });
            console.log(`[DEBUG-STREAKS] Created streak warning notification for ${freshUser.name}.`);
          }
        }
        console.log("[DEBUG-STREAKS] Wellness daily streak verification successfully completed.");
      } catch (err: any) {
        console.error("[DEBUG-STREAKS] Verification failed:", err);
      }
    })();
  } catch (err: any) {
    console.error("BOOTSTRAP ERROR STACK:", err.stack || err);
    console.error("\n✗ All MongoDB connection attempts failed.");
    console.error("  The server will start, but all /api/* requests will return HTTP 503.");
    console.error("\n  ══ QUICK FIX OPTIONS ══════════════════════════════════════════════");
    console.error("  Option A — Install in-memory MongoDB (zero-config, recommended for dev):");
    console.error("    npm install --save-dev mongodb-memory-server");
    console.error("    Then restart:  npm run dev");
    console.error("\n  Option B — Start local MongoDB in a separate terminal:");
    console.error("    /usr/local/mongodb/mongodb-macos-x86_64-7.0.34/bin/mongod \\");
    console.error("      --dbpath /Users/ansysn/Desktop/MindCare/data --port 27018 --bind_ip 127.0.0.1");
    console.error("\n  Option C — Use MongoDB Atlas (free cloud database):");
    console.error("    1. Sign up at https://www.mongodb.com/cloud/atlas (free)");
    console.error("    2. Create a cluster and get the connection string");
    console.error("    3. Update MONGODB_URI in .env");
    console.error("  ════════════════════════════════════════════════════════════════\n");
  }

  // ── Auto-Spawn & Verify Python NLP Service (FastAPI + spaCy + NLTK) ─────────────
  try {
    const { NlpService } = await import("./services/nlpService.ts");
    const isPyAvailable = await NlpService.isAvailable();
    if (!isPyAvailable) {
      console.log("⚡ Python NLP microservice (FastAPI + spaCy + NLTK) is offline. Auto-spawning on port 8001...");
      const pyPath = path.join(process.cwd(), "python-nlp", "venv", "bin", "python");
      const mainPath = path.join(process.cwd(), "python-nlp", "main.py");
      if (fs.existsSync(pyPath) && fs.existsSync(mainPath)) {
        const { spawn } = await import("child_process");
        const pyProc = spawn(pyPath, [mainPath], {
          stdio: "ignore",
          env: { ...process.env, NLP_PORT: "8001", NLP_HOST: "127.0.0.1" },
          detached: true,
        });
        pyProc.unref();
        let checkNow = false;
        for (let attempt = 0; attempt < 8; attempt++) {
          await new Promise((r) => setTimeout(r, 1000));
          checkNow = await NlpService.isAvailable();
          if (checkNow) break;
        }
        if (checkNow) {
          console.log("✓ Python NLP microservice successfully started on http://127.0.0.1:8001 (spaCy + NLTK active)");
        } else {
          console.log("⚠ Python NLP microservice failed to respond on http://127.0.0.1:8001. Fallback mode enabled.");
        }
      }
    } else {
      console.log("✓ Python NLP microservice active on http://127.0.0.1:8001 (spaCy + NLTK active)");
    }
  } catch (pyErr) {
    console.error("Failed to initialize Python NLP auto-spawner:", pyErr);
  }

  const httpServer = createServer(app);
  initSocketServer(httpServer);
  initCronJobs();
  const { startAppointmentReminderCron } = await import("./services/appointmentReminderService.ts");
  startAppointmentReminderCron();

  httpServer.listen(serverConfig.port, () => {
    const dbStatus = _dbConnected ? "✓ DB connected" : "⚠ DB NOT connected (503 on API calls)";
    console.log(`✓ Server running on port ${serverConfig.port} [${serverConfig.isProduction ? "production" : "development"}] | ${dbStatus}`);
  });
}

// ── Process-level safety nets ─────────────────────────────────────────────────
process.on("unhandledRejection", (reason: any) => {
  console.error("UNHANDLED REJECTION:", reason?.stack || reason);
});

process.on("uncaughtException", (err: Error) => {
  console.error("UNCAUGHT EXCEPTION — shutting down:", err.stack || err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully…`);
  await stopMemoryServerIfRunning();
  process.exit(0);
}
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap();
