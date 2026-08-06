import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../config/db.ts";
import { User } from "../models/User.ts";
import { Therapist } from "../models/Therapist.ts";
import { isValidPan, normalizePan } from "../utils/pan.ts";

dotenv.config();

/**
 * Normalizes legacy PAN values, reports invalid/colliding values, then creates
 * the canonical partial unique index. It deliberately refuses to create the
 * index while collisions exist so no account data is silently discarded.
 */
async function migratePanNumbers() {
  await connectDB();
  const report = { usersNormalized: 0, therapistsNormalized: 0, invalid: [] as string[], duplicates: [] as string[] };
  const seen = new Map<string, Set<string>>();

  for (const user of await User.find().select("+panNumber +panCard")) {
    const pan = normalizePan(user.panNumber || user.panCard);
    if (!pan) continue;
    if (!isValidPan(pan)) { report.invalid.push(`user:${user._id}`); continue; }
    seen.set(pan, new Set([...(seen.get(pan) || []), `user:${user._id}`]));
    if (user.panNumber !== pan || user.panCard !== undefined) {
      user.panNumber = pan;
      user.panCard = undefined;
      await user.save();
      report.usersNormalized++;
    }
  }

  for (const therapist of await Therapist.find().select("+panNumber")) {
    const pan = normalizePan(therapist.panNumber);
    if (!pan) continue;
    if (!isValidPan(pan)) { report.invalid.push(`therapist:${therapist._id}`); continue; }
    // A therapist profile linked to the same User is not a second account.
    seen.set(pan, new Set([...(seen.get(pan) || []), therapist.userId ? `user:${therapist.userId}` : `therapist:${therapist._id}`]));
    if (therapist.panNumber !== pan) { therapist.panNumber = pan; await therapist.save(); report.therapistsNormalized++; }
  }

  report.duplicates = [...seen.entries()].filter(([, records]) => records.size > 1).map(([pan, records]) => `${pan}: ${[...records].join(", ")}`);
  if (report.invalid.length || report.duplicates.length) {
    console.log(JSON.stringify({ status: "manual_resolution_required", ...report }, null, 2));
    process.exitCode = 2;
    return;
  }

  await User.collection.dropIndex("panNumber_1").catch((error: any) => { if (error.codeName !== "IndexNotFound") throw error; });
  await User.collection.createIndex({ panNumber: 1 }, { unique: true, partialFilterExpression: { panNumber: { $type: "string" } }, name: "unique_pan_number" });
  console.log(JSON.stringify({ status: "complete", ...report }, null, 2));
}

migratePanNumbers().finally(() => mongoose.disconnect());
