import mongoose from "mongoose";
import { serverConfig } from "./env.ts";

const MAX_RETRIES = 2;
const RETRY_INTERVAL_MS = 2000;

let _memoryServer: any = null;

/**
 * Attempt to connect to the configured MongoDB URI.
 * Returns true on success, throws on final failure.
 */
async function tryConnect(uri: string): Promise<boolean> {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
  });
  return true;
}

/**
 * Start an in-memory MongoDB instance as a development fallback.
 * Only used when the configured MONGODB_URI is unreachable.
 */
async function startMemoryServer(): Promise<string> {
  try {
    // Dynamically import so the package is optional in production
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    console.log("⚡ Starting in-memory MongoDB (development fallback)...");
    console.log("   ℹ️  Data is NOT persisted between restarts in this mode.");
    console.log("   ℹ️  To persist data, start a real MongoDB: mongod --dbpath ./data --port 27018");
    try {
      _memoryServer = await MongoMemoryServer.create({
        instance: {
          port: 27018,
          dbName: "mindcare"
        }
      });
    } catch (portErr: any) {
      console.warn("   ⚠️  Port 27018 is occupied. Allocating dynamic port instead...");
      _memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: "mindcare"
        }
      });
    }
    const uri = _memoryServer.getUri();
    console.log(`✓ In-memory MongoDB started at ${uri}`);
    return uri;
  } catch (err: any) {
    throw new Error(
      `Could not start in-memory MongoDB fallback: ${err.message}\n` +
      `Please either start a real MongoDB or install: npm install --save-dev mongodb-memory-server`
    );
  }
}

export async function connectDB(): Promise<void> {
  // ── First try the configured URI ─────────────────────────────────────────
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await tryConnect(serverConfig.mongoUri);
      console.log(`✓ MongoDB connected to ${serverConfig.mongoUri}`);
      return;
    } catch (error: any) {
      console.warn(`  MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
      }
    }
  }

  // ── In production, never fall back — fail hard ────────────────────────────
  if (serverConfig.isProduction) {
    console.error("\n╔══════════════════════════════════════════════════════════╗");
    console.error("║             FATAL: Cannot connect to MongoDB              ║");
    console.error("╚══════════════════════════════════════════════════════════╝");
    console.error(`URI: ${serverConfig.mongoUri}`);
    throw new Error("MongoDB unreachable in production. Fix MONGODB_URI in .env");
  }

// ── In development, enforce persistent MongoDB ───────────────────────
// Removed in-memory fallback to ensure data persistence.
if (!serverConfig.isProduction) {
  console.warn(`\n⚠️  Real MongoDB (${serverConfig.mongoUri}) is unreachable.`);
  console.warn('   The application requires a running MongoDB instance for data persistence.');
  console.warn('   Please start MongoDB or configure MONGODB_URI in .env.');
  process.exit(1);
}
}

/**
 * Gracefully stop the in-memory server if it was started.
 * Call this in process.on("SIGINT") / process.on("SIGTERM") handlers.
 */
export async function stopMemoryServerIfRunning(): Promise<void> {
  if (_memoryServer) {
    await _memoryServer.stop();
    console.log("✓ In-memory MongoDB stopped");
  }
}
