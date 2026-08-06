import { Schema, model } from "mongoose";

const AttachmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "CompanionSession" },
  },
  { timestamps: true }
);

AttachmentSchema.index({ userId: 1 });
AttachmentSchema.index({ sessionId: 1 });

export const Attachment = model("Attachment", AttachmentSchema);
