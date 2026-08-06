import { Schema, model } from "mongoose";

const ReviewSchema = new Schema({
  rating: { type: Number, required: true },
  text: { type: String, required: true },
  reviewerName: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const TherapistSchema = new Schema(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    specializations: [{ type: String }],
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    yearsExperience: { type: Number, required: true },
    consultationFee: { type: Number, required: true },
    // An empty schedule is a valid starting state. The therapist workspace
    // persists their actual weekly hours through the availability endpoint.
    availability: { type: String, required: true, default: "" },
    avatar: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    reviews: [ReviewSchema],
    qualification: { type: String },
    registrationNumber: { type: String },
    licenseNumber: { type: String },
    languages: [{ type: String }],
    hospitalClinic: { type: String },
    certificates: [{ type: String }],
    about: { type: String },
    bio: { type: String },
    patientsCount: { type: Number, default: 0 },
    verificationStatus: { type: String, enum: ["Pending", "Verified", "Rejected"], default: "Pending" },
    // Independent from appointment availability. Only explicit on-call clinicians
    // can receive emergency assignments.
    emergencyOnCall: { type: Boolean, default: false },
    emergencyStatus: { type: String, enum: ["offline", "available", "busy"], default: "offline" },
    emergencyCapacity: { type: Number, default: 1, min: 1 },
    // Kept only for backwards-compatible legacy therapist records. New accounts
    // use User.panNumber as the canonical identity field.
    panNumber: { type: String, trim: true, uppercase: true, select: false },
    panDocumentUrl: { type: String },
    panVerified: { type: Boolean, default: false },
    panUploadedAt: { type: Date },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
);

TherapistSchema.index({ userId: 1 }, { unique: true, sparse: true });

export const Therapist = model("Therapist", TherapistSchema);
