import { Request } from "express";
import mongoose from "mongoose";
import { AuditLog } from "../models/AuditLog.ts";

export async function logActivity({
  userId,
  userName,
  userEmail,
  role,
  action,
  status = "success",
  details,
  req,
}: {
  userId?: string;
  userName: string;
  userEmail: string;
  role: string;
  action: string;
  status?: "success" | "failed";
  details?: string;
  req?: Request;
}) {
  try {
    let ip = "";
    let userAgent = "";

    if (req) {
      ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
      userAgent = req.headers["user-agent"] || "";
    }

    const safeUserId = userId && mongoose.Types.ObjectId.isValid(userId) ? userId : undefined;

    await AuditLog.create({
      userId: safeUserId,
      userName,
      userEmail,
      role,
      action,
      status,
      ip,
      userAgent,
      details,
    });
  } catch (err) {
    console.error("Audit log logging error:", err);
  }
}
