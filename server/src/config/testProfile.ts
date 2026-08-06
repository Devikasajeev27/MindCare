import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { connectDB } from "./db.ts";
import { runAuthSelfTest } from "../controllers/testAuthController.ts";

class MockResponse {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  body: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name] = value;
    return this;
  }

  json(payload: any) {
    this.body = payload;
    return this;
  }

  send(payload: any) {
    this.body = payload;
    return this;
  }
}

async function run() {
  console.log("⚡ [TEST-RUNNER] Starting database connection...");
  try {
    await connectDB();
    console.log("⚡ [TEST-RUNNER] Database connected successfully.");

    const mockReq: any = {
      method: "GET",
      originalUrl: "/api/test-auth",
      requestId: "script-runner-1"
    };

    const mockRes = new MockResponse();

    console.log("⚡ [TEST-RUNNER] Invoking runAuthSelfTest suite...");
    await runAuthSelfTest(mockReq, mockRes as any);

    console.log("⚡ [TEST-RUNNER] Self-test complete. Status code:", mockRes.statusCode);
    const resultFilePath = path.join("/Users/ansysn/Desktop/MindCare", "auth_test_results.json");
    fs.writeFileSync(resultFilePath, JSON.stringify(mockRes.body, null, 2));
    console.log(`✓ [TEST-RUNNER] Saved detailed diagnosis report to ${resultFilePath}`);
  } catch (err: any) {
    console.error("❌ [TEST-RUNNER] Script failed:", err.stack || err);
  } finally {
    await mongoose.connection.close();
    console.log("⚡ [TEST-RUNNER] Closed Mongoose connection.");
    process.exit(0);
  }
}

run();
