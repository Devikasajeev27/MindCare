import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "therapist", "admin"], default: "user" },
    age: { type: Number },
    gender: { type: String },
    phone: { type: String },
    emergencyContact: {
      name: { type: String },
      phone: { type: String },
      relation: { type: String },
      email: { type: String, lowercase: true, trim: true },
    },
    wellnessScore: { type: Number, default: 70 },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    maxXp: { type: Number, default: 100 },
    avatar: { type: String },
    streak: { type: Number, default: 0 },
    // PAN is stored only on the account identity record.  A partial unique index
    // permits legacy accounts without a PAN while enforcing platform-wide uniqueness.
    panCard: { type: String, trim: true, uppercase: true, select: false },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      select: false,
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN number format"],
    },
    panDocumentUrl: { type: String },
    panVerified: { type: Boolean, default: false },
    panUploadedAt: { type: Date },
    verifiedAt: { type: Date },
    verificationStatus: { type: String, enum: ["Pending", "Verified", "Rejected"], default: "Pending" },
    lastActivityDate: { type: Date },
    onboardingCompleted: { type: Boolean, default: false },
    onboardingData: { type: Schema.Types.Mixed },
    country: { type: String, default: "India" },
    countryCode: { type: String, default: "IN" },
    dialCode: { type: String, default: "+91" },
    phoneNumber: { type: String },
    currency: { type: String, default: "Indian Rupee" },
    currencyCode: { type: String, default: "INR" },
    phoneVerified: { type: Boolean, default: false },
    dateOfBirth: { type: Date },
    preferredLocale: { type: String, default: "en-IN" },
    timezone: { type: String, default: "Asia/Kolkata" },
    status: { type: String, enum: ["pending", "approved", "suspended", "rejected", "blocked"], default: "approved" },
    verifiedCompanion: { type: Boolean, default: false },
    companionVerificationStatus: { type: String, enum: ["none", "pending", "verified", "rejected"], default: "none" },
    isAvailableAsCompanion: { type: Boolean, default: false },
    activePlan: {
      planId: { type: Schema.Types.ObjectId, ref: "BillingPlan" },
      expiresAt: { type: Date }
    },
    bio: { type: String },
    address: { type: String },
    city: { type: String, default: "Kochi" },
    state: { type: String, default: "Kerala" },
    walletBalance: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      weekly: { type: Boolean, default: true },
      crisis: { type: Boolean, default: true },
    },
    privacySettings: {
      anonymousMode: { type: Boolean, default: false },
      twoFactorAuth: { type: Boolean, default: true },
      dataSharing: { type: Boolean, default: false },
    },
    // Therapist Fields
    availability: [
      {
        day: { type: String, enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
        slots: [{ type: String }] // e.g. ["09:00", "10:00"]
      }
    ],
    reviews: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    averageRating: { type: Number, default: 0 },
  },
  { timestamps: true }
);

UserSchema.index(
  { panNumber: 1 },
  { unique: true, partialFilterExpression: { panNumber: { $type: "string" } }, name: "unique_pan_number" }
);

export const User = model("User", UserSchema);
