import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../models/User.ts";
import { BlockedAccount } from "../models/BlockedAccount.ts";
import { Appointment } from "../models/Appointment.ts";
import { AuthRequest } from "../middleware/auth.ts";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Therapist } from "../models/Therapist.ts";
import { logActivity } from "../utils/auditLogger.ts";
import { serverConfig } from "../config/env.ts";
import { asyncHandler } from "../middleware/asyncHandler.ts";
import { sendResponse } from "../utils/response.ts";
import { isValidPan, maskPan, normalizePan } from "../utils/pan.ts";

// ── Helpers ── (trigger reload comment 2)

function generateToken(id: string): string {
  const secret = serverConfig.jwtSecret || "supersecretjwtkey123_dev_only";
  return jwt.sign({ id }, secret, { expiresIn: "30d" });
}

function buildUserPayload(user: any) {
  const maskedPan = maskPan(user.panNumber || user.panCard);

  return {
    id: user._id ? user._id.toString() : "",
    name: user.name || "",
    email: user.email || "",
    role: user.role || "user",
    age: user.age,
    gender: user.gender,
    phone: user.phone,
    avatar: user.avatar || "",
    wellnessScore: user.wellnessScore || 70,
    streak: user.streak || 0,
    level: user.level || 1,
    xp: user.xp || 0,
    maxXp: user.maxXp || 100,
    onboardingCompleted: !!user.onboardingCompleted,
    emergencyContact: user.emergencyContact || {},
    country: user.country || "India",
    countryCode: user.countryCode || "IN",
    dialCode: user.dialCode || "+91",
    phoneNumber: user.phoneNumber || user.phone || "",
    currency: user.currency || "Indian Rupee",
    currencyCode: user.currencyCode || "INR",
    phoneVerified: !!user.phoneVerified,
    preferredLocale: user.preferredLocale || "en-IN",
    status: user.status || "approved",
    verifiedCompanion: !!user.verifiedCompanion,
    companionVerificationStatus: user.companionVerificationStatus || "none",
    isAvailableAsCompanion: !!user.isAvailableAsCompanion,
    bio: user.bio || "",
    walletBalance: user.walletBalance || 0,
    panNumber: maskedPan,
    panVerified: !!user.panVerified,
    verificationStatus: user.verificationStatus || "Pending",
    panUploadedAt: user.panUploadedAt,
  };
}

// ── Controllers ──────────────────────────────────────────────────────────────

export const register = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Register attempt initiated.`);

  const {
    fullName,
    email,
    phone,
    age,
    gender,
    password,
    role,
    qualification,
    specialization,
    experience,
    licenseNumber,
    emergencyName,
    emergencyPhone,
    emergencyRelation,
    country,
    countryCode,
    dialCode,
    phoneNumber,
    currency,
    currencyCode,
    phoneVerified,
    preferredLocale,
    panNumber,
    panCard,
    panDocumentUrl,
  } = req.body;

  // ── Input validation ──
  if (!fullName || !email || !password) {
    await logActivity({
      userName: fullName || "Guest",
      userEmail: email || "unknown",
      role: "guest",
      action: "REGISTER",
      status: "failed",
      details: "Missing required fields: name, email, or password",
      req,
    });
    return sendResponse(res, 400, false, "Please provide name, email, and password", null, {
      errors: ["fullName, email, password are required"]
    }, req);
  }

  // ── PAN Validation & Uniqueness Check (Part 7 & Part 8) ──
  const rawPanInput = String(panNumber || panCard || "").trim();
  if (!rawPanInput) {
    return sendResponse(res, 400, false, "PAN number is mandatory for registration.", null, {
      errors: ["panNumber is required"]
    }, req);
  }

  const formattedPan = normalizePan(rawPanInput);
  if (!isValidPan(formattedPan)) {
    return sendResponse(res, 400, false, "Invalid PAN Card Number. Use the format ABCDE1234F.", null, {
      errors: ["Invalid PAN format"]
    }, req);
  }

  const [blockedPan, panExists, therapistPanExists] = await Promise.all([
    BlockedAccount.findOne({ panNumber: formattedPan }),
    User.findOne({
    $or: [{ panNumber: formattedPan }, { panCard: formattedPan }]
    }).select("+panNumber +panCard status"),
    Therapist.findOne({ panNumber: formattedPan }).select("userId"),
  ]);

  const restrictedStatuses = new Set(["blocked", "suspended", "disabled", "banned"]);
  if (blockedPan || (panExists && restrictedStatuses.has(panExists.status))) {
    await logActivity({ userName: fullName || "Guest", userEmail: email || "unknown", role: "guest", action: "PAN_REGISTRATION_DENIED", status: "failed", details: "Registration denied for an existing restricted PAN", req });
    return sendResponse(res, 403, false, "This PAN Card Number is already associated with an existing account. Please contact support if you believe this is an error.", null, {
      errors: ["PAN associated with blocked account"]
    }, req);
  }

  if (panExists || therapistPanExists) {
    await logActivity({ userName: fullName || "Guest", userEmail: email || "unknown", role: "guest", action: "PAN_DUPLICATE_REGISTRATION", status: "failed", details: "Duplicate PAN registration attempt", req });
    return sendResponse(res, 409, false, "This PAN Card Number is already associated with an existing account.", null, {
      errors: ["PAN number already registered"]
    }, req);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return sendResponse(res, 422, false, "Please provide a valid email address", null, {
      errors: ["email format is invalid"]
    }, req);
  }

  if (password.length < 6) {
    return sendResponse(res, 422, false, "Password must be at least 6 characters", null, {
      errors: ["password length must be >= 6"]
    }, req);
  }

  // ── Duplicate check ──
  const userExists = await User.findOne({ email: email.toLowerCase() });
  if (userExists) {
    await logActivity({
      userName: fullName,
      userEmail: email,
      role: "guest",
      action: "REGISTER",
      status: "failed",
      details: `Duplicate email: ${email}`,
      req,
    });
    return sendResponse(res, 409, false, "An account with this email already exists", null, {
      errors: ["email already registered"]
    }, req);
  }

  // ── Phone validation ──
  if (phone) {
    const parsedPhone = parsePhoneNumberFromString(phone);
    if (!parsedPhone || !parsedPhone.isValid()) {
      return sendResponse(res, 422, false, "Please enter a valid phone number.", null, {
        errors: ["invalid phone format"]
      }, req);
    }
  }
  if (emergencyPhone) {
    const parsedEmergency = parsePhoneNumberFromString(emergencyPhone);
    if (!parsedEmergency || !parsedEmergency.isValid()) {
      return sendResponse(res, 422, false, "Please enter a valid emergency contact phone number.", null, {
        errors: ["invalid emergency phone format"]
      }, req);
    }
  }

  // ── Password hashing ──
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const userRole = role || "user";
  const userStatus = userRole === "therapist" ? "pending" : "approved";

  console.log(`[AUTH-DEBUG] Register - Creating User model record for role: ${userRole}`);
  let user: any;
  try {
    user = await User.create({
    name: fullName,
    email: email.toLowerCase(),
    phone: phone ? (parsePhoneNumberFromString(phone)?.number || phone) : undefined,
    age: age ? Number(age) : undefined,
    gender,
    password: hashedPassword,
    avatar: "",
    role: userRole,
    status: userStatus,
    panNumber: formattedPan,
    panDocumentUrl: panDocumentUrl || "",
    panVerified: false,
    panUploadedAt: panDocumentUrl ? new Date() : undefined,
    verificationStatus: "Pending",
    emergencyContact: {
      name: emergencyName,
      phone: emergencyPhone
        ? (parsePhoneNumberFromString(emergencyPhone)?.number || emergencyPhone)
        : undefined,
      relation: emergencyRelation,
    },
    wellnessScore: 70,
    streak: 1,
    level: 1,
    xp: 10,
    maxXp: 100,
    // New accounts start on the dashboard; onboarding is no longer a required
    // registration step.
    onboardingCompleted: true,
    country: country || "India",
    countryCode: countryCode || "IN",
    dialCode: dialCode || "+91",
    phoneNumber: phoneNumber || phone,
    currency: currency || "Indian Rupee",
    currencyCode: currencyCode || "INR",
    phoneVerified: phoneVerified || false,
    preferredLocale: preferredLocale || "en-IN",
    });
  } catch (error: any) {
    // The unique index is the final authority when two requests race.
    if (error?.code === 11000 && (error?.keyPattern?.panNumber || error?.keyValue?.panNumber)) {
      return sendResponse(res, 409, false, "This PAN Card Number is already associated with an existing account.", null, {
        errors: ["PAN number already registered"]
      }, req);
    }
    throw error;
  }

  if (userRole === "therapist") {
    console.log(`[AUTH-DEBUG] Register - Creating Therapist model record for therapistUserId: ${user._id}`);
    await Therapist.create({
      name: fullName,
      title: qualification || "Therapist",
      specializations: specialization ? [specialization] : ["General"],
      yearsExperience: Number(experience) || 1,
      consultationFee: 50,
      availability: "Mon-Fri (9:00 AM - 5:00 PM)",
      avatar: "",
      userId: user._id,
      licenseNumber: licenseNumber || "",
      reviews: [],
    });
  }

  await logActivity({
    userId: user._id.toString(),
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    action: "REGISTER",
    status: "success",
    details: `Registered with role ${user.role} (status: ${userStatus})`,
    req,
  });

  const token = generateToken(user._id.toString());
  const userPayload = buildUserPayload(user);
  const executionTime = Date.now() - startTime;

  console.log(`[AUTH-DEBUG] Register success - execution time: ${executionTime}ms`);
  return sendResponse(res, 201, true, "Registration successful", {
    token,
    user: userPayload,
  }, null, req);
});

// ─────────────────────────────────────────────────────────────────────────────

export const login = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Login attempt for email: ${req.body?.email || "(no email)"}`);

  const { email, password } = req.body || {};

  if (!email || !password) {
    return sendResponse(res, 400, false, "Please provide email and password", null, {
      errors: ["email and password are required"]
    }, req);
  }

  if (typeof email !== "string" || typeof password !== "string") {
    return sendResponse(res, 422, false, "Invalid request format", null, {
      errors: ["email and password must be strings"]
    }, req);
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  let user: any = null;
  try {
    user = await User.findOne({ email: normalizedEmail });
  } catch (dbErr: any) {
    console.error("[AUTH-ERROR] Database error during User.findOne in login:", dbErr);
    return sendResponse(res, 500, false, "Database query failed during login", null, { error: dbErr.message }, req);
  }

  if (!user) {
    console.log(`[AUTH-DEBUG] Login failed — no user found for: ${normalizedEmail}`);
    await logActivity({
      userName: "Unknown",
      userEmail: normalizedEmail,
      role: "guest",
      action: "LOGIN",
      status: "failed",
      details: `No account for email: ${normalizedEmail}`,
      req,
    }).catch(() => {});

    return sendResponse(res, 401, false, "Invalid email or password", null, {
      errors: ["user not found"]
    }, req);
  }

  // ── Account lockout check ──
  if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.lockUntil).getTime() - Date.now()) / 60_000);
    console.log(`[AUTH-DEBUG] Login failed — account locked for email: ${normalizedEmail}`);
    return sendResponse(res, 423, false, `Account temporarily locked. Try again in ${minutesLeft} minute(s).`, null, {
      code: "ACCOUNT_LOCKED",
      lockUntil: user.lockUntil,
    }, req);
  }

  // ── Password comparison ──
  if (!user.password || typeof user.password !== "string") {
    console.log(`[AUTH-DEBUG] Login failed — invalid stored password hash for: ${normalizedEmail}`);
    return sendResponse(res, 401, false, "Invalid email or password", null, {
      errors: ["invalid stored credentials"]
    }, req);
  }

  let isMatch = false;
  try {
    isMatch = await bcrypt.compare(password, user.password);
  } catch (bcryptErr: any) {
    console.error("[AUTH-ERROR] Bcrypt comparison error:", bcryptErr);
    return sendResponse(res, 401, false, "Invalid email or password", null, { errors: ["password comparison failed"] }, req);
  }

  if (!isMatch) {
    console.log(`[AUTH-DEBUG] Login failed — wrong password for: ${normalizedEmail}`);
    try {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60_000);
      }
      await user.save();
    } catch (saveErr) {
      console.warn("[AUTH-WARN] Could not update failed login attempt count:", saveErr);
    }

    await logActivity({
      userId: user._id ? user._id.toString() : undefined,
      userName: user.name || "User",
      userEmail: user.email || normalizedEmail,
      role: user.role || "user",
      action: "LOGIN",
      status: "failed",
      details: `Wrong password (attempt ${user.failedLoginAttempts || 1})`,
      req,
    }).catch(() => {});

    if ((user.failedLoginAttempts || 0) >= 5) {
      return sendResponse(res, 423, false, "Account locked for 15 minutes due to multiple failed login attempts.", null, {
        code: "ACCOUNT_LOCKED",
        lockUntil: user.lockUntil,
      }, req);
    }

    return sendResponse(res, 401, false, "Invalid email or password", null, {
      errors: ["incorrect password"]
    }, req);
  }

  // ── Blocked account check ──
  if (user.status === "blocked") {
    return sendResponse(res, 403, false, "This account has been blocked due to policy violation.", null, { code: "STATUS_BLOCKED" }, req);
  }

  const isBlockedRecord = await BlockedAccount.findOne({
    $or: [
      { userId: user._id },
      { email: user.email },
      ...(user.panNumber ? [{ panNumber: user.panNumber }] : [])
    ]
  });
  if (isBlockedRecord) {
    return sendResponse(res, 403, false, "This account has been blocked due to policy violation.", null, { code: "STATUS_BLOCKED" }, req);
  }

  // ── Therapist status checks ──
  if (user.role === "therapist") {
    if (user.status === "pending") {
      return sendResponse(res, 403, false, "Your account is awaiting administrator approval.", null, { code: "STATUS_PENDING" }, req);
    }
    if (user.status === "suspended") {
      return sendResponse(res, 403, false, "Your account has been suspended by an administrator.", null, { code: "STATUS_SUSPENDED" }, req);
    }
    if (user.status === "rejected") {
      return sendResponse(res, 403, false, "Your registration request was rejected by an administrator.", null, { code: "STATUS_REJECTED" }, req);
    }
  }

  if (user.role !== "therapist" && user.status === "suspended") {
    return sendResponse(res, 403, false, "Your account has been suspended.", null, { code: "STATUS_SUSPENDED" }, req);
  }

  // ── Success: reset lockout counters ──
  try {
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    if (user.streak === 0) user.streak = 1;
    await user.save();
  } catch (err: any) {
    console.warn("[AUTH-WARN] Login metadata save failed:", err.message);
  }

  console.log(`[AUTH-DEBUG] Login success: ${user.email} (${user.role})`);

  await logActivity({
    userId: user._id ? user._id.toString() : undefined,
    userName: user.name || "User",
    userEmail: user.email || normalizedEmail,
    role: user.role || "user",
    action: "LOGIN",
    status: "success",
    details: "Successful login",
    req,
  }).catch(() => {});

  try {
    const token = generateToken(user._id.toString());
    const userPayload = buildUserPayload(user);
    const executionTime = Date.now() - startTime;

    console.log(`[AUTH-DEBUG] Login completed successfully in ${executionTime}ms`);
    return sendResponse(res, 200, true, "Login successful", {
      token,
      user: userPayload,
    }, null, req);
  } catch (finalErr: any) {
    console.error("[AUTH-ERROR] Error building login response:", finalErr);
    return sendResponse(res, 500, false, "Login failed during response creation", null, { error: finalErr.message }, req);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

export const getProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Retrieve profile for userId: ${req.user?._id}`);
    if (!req.user || !req.user._id) {
      return sendResponse(res, 401, false, "Not authorized, user missing", null, {
        errors: ["user not present in authorization context"]
      }, req);
    }

    let userToUse = req.user;
    try {
      const freshUser = await User.findById(req.user._id).select("-password");
      if (freshUser) userToUse = freshUser;
    } catch (dbErr: any) {
      console.warn("[AUTH-WARN] Could not fetch fresh user in getProfile, using context user:", dbErr.message);
    }

    let payload: any;
    try {
      payload = buildUserPayload(userToUse);
    } catch (payloadError: any) {
      // Profile availability must not depend on optional profile extensions.
      console.error("[AUTH-ERROR] Profile payload mapping failed:", payloadError);
      payload = {
        id: userToUse._id?.toString(), name: userToUse.name || "", email: userToUse.email || "",
        role: userToUse.role || "user", status: userToUse.status || "approved", avatar: userToUse.avatar || "",
      };
    }
    return sendResponse(res, 200, true, "Profile retrieved successfully", {
      user: payload,
    }, null, req);
  } catch (err: any) {
    console.error('[AUTH-ERROR] getProfile failed:', err);
    return sendResponse(res, 500, false, "Internal Server Error", null, { error: err.message }, req);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Update profile for userId: ${req.user?._id}`);
  const user = await User.findById(req.user._id);
  if (!user) {
    return sendResponse(res, 404, false, "User not found", null, {
      errors: ["user document not found in database"]
    }, req);
  }

  const {
    name,
    phone,
    age,
    gender,
    emergencyContact,
    avatar,
    country,
    countryCode,
    dialCode,
    phoneNumber,
    currency,
    currencyCode,
    phoneVerified,
    preferredLocale,
    bio,
  } = req.body;

  if (name) user.name = name;
  if (phone) {
    const parsed = parsePhoneNumberFromString(phone, (user.countryCode as any) || 'IN');
    if (parsed && parsed.isValid()) {
      user.phone = parsed.number;
    } else if (/^\+?[0-9\s\-\(\)]{7,20}$/.test(phone)) {
      user.phone = phone.trim();
    } else {
      return sendResponse(res, 422, false, "Please enter a valid phone number.", null, {
        errors: ["invalid phone format"]
      }, req);
    }
  }
  if (age !== undefined) user.age = Number(age);
  if (gender) user.gender = gender;
  if (avatar) user.avatar = avatar;
  if (country) user.country = country;
  if (countryCode) user.countryCode = countryCode;
  if (dialCode) user.dialCode = dialCode;
  if (phoneNumber) user.phoneNumber = phoneNumber;
  if (currency) user.currency = currency;
  if (currencyCode) user.currencyCode = currencyCode;
  if (phoneVerified !== undefined) user.phoneVerified = phoneVerified;
  if (preferredLocale) user.preferredLocale = preferredLocale;
  if (bio) user.bio = bio;
  if (emergencyContact) {
    let emergencyContactPhone = emergencyContact.phone;
    if (emergencyContactPhone) {
      const parsedEmergency = parsePhoneNumberFromString(emergencyContactPhone, (user.countryCode as any) || 'IN');
      if (parsedEmergency && parsedEmergency.isValid()) {
        emergencyContactPhone = parsedEmergency.number;
      } else if (/^\+?[0-9\s\-\(\)]{7,20}$/.test(emergencyContactPhone)) {
        emergencyContactPhone = emergencyContactPhone.trim();
      } else {
        return sendResponse(res, 422, false, "Please enter a valid emergency contact phone number.", null, {
          errors: ["invalid emergency phone format"]
        }, req);
      }
    }
    user.emergencyContact = {
      name: emergencyContact.name || user.emergencyContact?.name || "",
      phone: emergencyContactPhone || user.emergencyContact?.phone || "",
      relation: emergencyContact.relation || user.emergencyContact?.relation || "",
    };

    try {
      const { EmergencyContact } = await import("../models/EmergencyContact.ts");
      await EmergencyContact.findOneAndUpdate(
        { userId: user._id },
        {
          userId: user._id,
          name: emergencyContact.name || user.emergencyContact?.name,
          relationship: emergencyContact.relation || user.emergencyContact?.relation || "Relative",
          countryCode: "+91",
          phone: emergencyContactPhone || user.emergencyContact?.phone,
          priority: 1
        },
        { upsert: true, new: true }
      );
    } catch (syncErr: any) {
      console.error("[EmergencySync] Failed to sync to EmergencyContact collection:", syncErr.message);
    }
  }

  await user.save();

  // Sync therapist profile if applicable
  if (user.role === "therapist") {
    let therapist = await Therapist.findOne({ userId: user._id });
    const { qualification, title, consultationFee, specializations } = req.body;
    if (!therapist) {
      therapist = new Therapist({
        userId: user._id,
        name: user.name,
        title: title || qualification || "Clinical Psychologist",
        qualification: qualification || title || "M.Phil Clinical Psychology",
        specializations: Array.isArray(specializations) ? specializations : (specializations ? specializations.split(",").map((s: string) => s.trim()) : ["Anxiety", "Depression"]),
        consultationFee: Number(consultationFee) || 1200,
        bio: bio || user.bio || "Dedicated mental health professional.",
        reviewCount: 0,
      });
    } else {
      if (user.name) therapist.name = user.name;
      if (qualification) therapist.qualification = qualification;
      if (title) therapist.title = title;
      if (bio) therapist.bio = bio;
      if (consultationFee !== undefined && !isNaN(Number(consultationFee))) therapist.consultationFee = Number(consultationFee);
      if (specializations) {
        therapist.specializations = Array.isArray(specializations)
          ? specializations
          : specializations.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }
    await therapist.save();
  }

  await logActivity({
    userId: user._id.toString(),
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    action: "UPDATE_PROFILE",
    status: "success",
    details: "Profile updated",
    req,
  });

  return sendResponse(res, 200, true, "Profile updated successfully", {
    user: buildUserPayload(user),
  }, null, req);
});

// ─────────────────────────────────────────────────────────────────────────────

export const completeOnboarding = asyncHandler(async (req: AuthRequest, res: Response) => {
  console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Onboarding completed for userId: ${req.user?._id}`);
  const user = await User.findById(req.user._id);
  if (!user) {
    return sendResponse(res, 404, false, "User not found", null, {
      errors: ["user document not found in database"]
    }, req);
  }

  const { answers, wellnessScore } = req.body;

  user.onboardingCompleted = true;
  user.onboardingData = answers;
  if (wellnessScore !== undefined) {
    user.wellnessScore = Number(wellnessScore);
  }
  user.xp += 50;
  if (user.xp >= user.maxXp) {
    user.level += 1;
    user.xp = user.xp - user.maxXp;
    user.maxXp = user.level * 100;
  }

  await user.save();

  return sendResponse(res, 200, true, "Onboarding completed successfully", {
    user: buildUserPayload(user),
  }, null, req);
});

// ─────────────────────────────────────────────────────────────────────────────

export const toggleCompanionStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Toggle companion status for userId: ${req.user?._id}`);
  const { isAvailableAsCompanion } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    return sendResponse(res, 404, false, "User not found", null, {
      errors: ["user document not found in database"]
    }, req);
  }

  if (!user.verifiedCompanion) {
    user.verifiedCompanion = true;
    user.companionVerificationStatus = "verified";
  }

  user.isAvailableAsCompanion = isAvailableAsCompanion;
  await user.save();

  return sendResponse(res, 200, true, "Companion status toggled successfully", {
    isAvailableAsCompanion: user.isAvailableAsCompanion
  }, null, req);
});

// ─────────────────────────────────────────────────────────────────────────────

// Duplicate deleteAccount implementation removed – retained later version with password confirmation.


// ─────────────────────────────────────────────────────────────────────────────

export const exportUserData = asyncHandler(async (req: AuthRequest, res: Response) => {
  console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Exporting user data for userId: ${req.user?._id}`);
  const userId = req.user._id;

  const { Chat } = await import("../models/Chat.ts");
  const { Journal } = await import("../models/Journal.ts");
  const { Mood } = await import("../models/Mood.ts");
  const { Notification } = await import("../models/Notification.ts");
  const { Appointment } = await import("../models/Appointment.ts");
  const { PaymentHistory } = await import("../models/PaymentHistory.ts");

  const [chats, journals, moods, notifications, appointments, payments] = await Promise.all([
    Chat.find({ userId }),
    Journal.find({ userId }),
    Mood.find({ userId }),
    Notification.find({ userId }),
    Appointment.find({ userId }),
    PaymentHistory.find({ userId }),
  ]);

  const exportData = {
    exportedAt: new Date(),
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      wellnessScore: req.user.wellnessScore,
      streak: req.user.streak,
      country: req.user.country,
      currency: req.user.currency,
    },
    chats,
    journals,
    moods,
    notifications,
    appointments,
    payments,
  };

  res.setHeader("Content-disposition", `attachment; filename=mindcare_export_${userId}.json`);
  res.setHeader("Content-type", "application/json");
  return res.status(200).send(JSON.stringify(exportData, null, 2));
});

export const uploadPanDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { panNumber, documentType } = req.body;

  if (!panNumber) {
    return sendResponse(res, 400, false, "PAN number is required", null, { errors: ["panNumber missing"] }, req);
  }

  const formattedPan = String(panNumber).toUpperCase().trim();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (!panRegex.test(formattedPan)) {
    return sendResponse(res, 422, false, "Invalid PAN number format. Expected 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).", null, { errors: ["invalid PAN format"] }, req);
  }

  const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
  if (documentType && !allowedTypes.includes(documentType.toLowerCase())) {
    return sendResponse(res, 400, false, "Unsupported upload format. Please upload PDF, JPG, JPEG, or PNG.", null, { errors: ["unsupported file format"] }, req);
  }

  const fileRefUrl = `/uploads/pan_${req.user._id}_${Date.now()}.${documentType?.includes("pdf") ? "pdf" : "png"}`;

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        panNumber: formattedPan,
        panCard: formattedPan,
        panDocumentUrl: fileRefUrl,
        panUploadedAt: new Date(),
        verificationStatus: req.user.role === "therapist" ? "Pending" : "Verified"
      }
    },
    { new: true }
  );

  return sendResponse(res, 200, true, "PAN document reference stored securely in MongoDB.", {
    panDocumentUrl: fileRefUrl,
    panNumber: formattedPan,
    user: updatedUser
  }, null, req);
});

// ── Additional Production Flows ──────────────────────────────────────────────

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Forgot password attempt for email: ${req.body?.email}`);
  const { email } = req.body;
  if (!email) {
    return sendResponse(res, 400, false, "Please provide email", null, {
      errors: ["email is required"]
    }, req);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    console.log(`[AUTH-DEBUG] Forgot password - no user found for email: ${email}`);
    return sendResponse(res, 200, true, "If that email is registered, we have sent a reset code.", null, null, req);
  }

  const resetCode = "123456";
  console.log(`[AUTH-DEBUG] Password Reset Code generated for ${email}: ${resetCode}`);

  await logActivity({
    userId: user._id.toString(),
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    action: "FORGOT_PASSWORD_REQUEST",
    status: "success",
    details: `Generated password reset code: ${resetCode}`,
    req,
  });

  return sendResponse(res, 200, true, "If that email is registered, we have sent a reset code.", {
    resetCode: serverConfig.isProduction ? undefined : resetCode
  }, null, req);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Reset password request for email: ${req.body?.email}`);
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return sendResponse(res, 400, false, "Please provide email, code, and newPassword", null, {
      errors: ["email, code, and newPassword are required"]
    }, req);
  }

  // Verify reset code (placeholder logic)
  if (code !== "123456") {
    return sendResponse(res, 400, false, "Invalid verification code", null, { errors: ["verification code is incorrect"] }, req);
  }

  // Find user by email
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    return sendResponse(res, 404, false, "User not found", null, { errors: ["user not found"] }, req);
  }

  if (newPassword.length < 6) {
    return sendResponse(res, 422, false, "Password must be at least 6 characters", null, { errors: ["password length must be >= 6"] }, req);
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  await logActivity({
    userId: user._id.toString(),
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    action: "RESET_PASSWORD_SUCCESS",
    status: "success",
    details: "Password reset successfully",
    req,
  });

  return sendResponse(res, 200, true, "Password reset successfully", null, null, req);
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  console.log(`[AUTH-DEBUG] [${req.method}] ${req.originalUrl} - Logout for user: ${req.user?._id}`);
  if (req.user) {
    await logActivity({
      userId: req.user._id.toString(),
      userName: req.user.name,
      userEmail: req.user.email,
      role: req.user.role,
      action: "LOGOUT",
      status: "success",
      details: "Logout action completed",
      req,
    });
  }
  return sendResponse(res, 200, true, "Logout successful", null, null, req);
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return sendResponse(res, 400, false, "Please provide currentPassword and newPassword", null, {
      errors: ["currentPassword and newPassword are required"]
    }, req);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return sendResponse(res, 404, false, "User not found", null, null, req);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return sendResponse(res, 401, false, "Current password is incorrect", null, {
      errors: ["incorrect current password"]
    }, req);
  }

  if (newPassword.length < 6) {
    return sendResponse(res, 422, false, "New password must be at least 6 characters", null, {
      errors: ["newPassword length must be >= 6"]
    }, req);
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(newPassword, salt);
  await user.save();

  await logActivity({
    userId: user._id.toString(),
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    action: "CHANGE_PASSWORD",
    status: "success",
    details: "Password updated successfully",
    req,
  });

  return sendResponse(res, 200, true, "Password updated successfully", null, null, req);
});

export const deleteAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { password } = req.body || {};
  if (!password) {
    return sendResponse(res, 400, false, "Password confirmation is required to delete your account.", null, {
      errors: ["password confirmation required"]
    }, req);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return sendResponse(res, 404, false, "User not found", null, null, req);
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return sendResponse(res, 401, false, "Incorrect password. Account deletion cancelled.", null, {
      errors: ["incorrect password for account deletion"]
    }, req);
  }

  const userId = user._id;

  if (user.role === "therapist") {
    await Therapist.deleteMany({ userId });
  }

  await Appointment.updateMany(
    { $or: [{ userId }, { therapistId: userId }] },
    { $set: { status: "cancelled", notes: "Account deleted by user" } }
  );

  await User.findByIdAndDelete(userId);

  await logActivity({
    userId: userId.toString(),
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    action: "DELETE_ACCOUNT",
    status: "success",
    details: "Account permanently deleted",
    req,
  });

  return sendResponse(res, 200, true, "Account permanently deleted successfully", null, null, req);
});
