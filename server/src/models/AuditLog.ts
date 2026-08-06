import { Schema, model } from "mongoose";

const AuditLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    role: { type: String, required: true },
    action: { type: String, required: true }, // e.g. "LOGIN", "LOGOUT", "USER_REGISTER"
    status: { type: String, enum: ["success", "failed"], default: "success" },
    ip: { type: String },
    userAgent: { type: String },
    details: { type: String },
  },
  { timestamps: true }
);

export const AuditLog = model("AuditLog", AuditLogSchema);
