import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.ts";
import { serverConfig } from "../config/env.ts";
import { sendResponse } from "../utils/response.ts";

export interface AuthRequest extends Request {
  user?: any;
  requestId?: string;
}

export async function protect(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendResponse(res, 401, false, "Not authorized, no token", null, null, req);
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return sendResponse(res, 401, false, "Not authorized, token missing", null, null, req);
  }

  try {
    const decoded: any = jwt.verify(token, serverConfig.jwtSecret);

    if (!decoded?.id) {
      return sendResponse(res, 401, false, "Not authorized, invalid token payload", null, null, req);
    }

    // Fetch the user from DB
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      console.error('[AUTH-MIDDLEWARE] User not found for id:', decoded.id);
      return sendResponse(res, 401, false, "Not authorized, user no longer exists", null, null, req);
    }

    // Always re-check account status after decoding a JWT. This invalidates an
    // already-issued session immediately when an administrator blocks a user.
    if (user.status === "blocked") {
      return sendResponse(res, 403, false, "This account has been blocked. Please contact support.", null, { code: "STATUS_BLOCKED" }, req);
    }

    req.user = user;
    return next();
  } catch (error: any) {
    console.error("[AUTH MIDDLEWARE] Token verification failed:", error.message);
    if (error.name === "TokenExpiredError") {
      return sendResponse(res, 401, false, "Session expired, please log in again", null, { code: "TOKEN_EXPIRED" }, req);
    }
    if (error.name === "JsonWebTokenError") {
      return sendResponse(res, 401, false, "Not authorized, invalid token", null, { code: "TOKEN_INVALID" }, req);
    }
    return sendResponse(res, 401, false, "Not authorized, token failed", null, { error: error.message }, req);
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendResponse(res, 401, false, "Not authorized", null, null, req);
    }
    if (!roles.includes(req.user.role)) {
      return sendResponse(res, 403, false, "Forbidden: insufficient permissions", null, null, req);
    }
    return next();
  };
}

export function requireSubscription(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return sendResponse(res, 401, false, "Not authorized", null, null, req);
  }

  // Admins and therapists bypass subscription checks
  if (["admin", "therapist"].includes(req.user.role)) {
    return next();
  }

  const { activePlan } = req.user;
  if (!activePlan || !activePlan.planId) {
    return sendResponse(res, 403, false, "Active subscription required for this feature", null, null, req);
  }
  if (activePlan.expiresAt && new Date(activePlan.expiresAt) < new Date()) {
    return sendResponse(res, 403, false, "Subscription expired", null, null, req);
  }

  return next();
}
