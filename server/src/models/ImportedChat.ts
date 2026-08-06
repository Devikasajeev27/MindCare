import { Schema, model } from "mongoose";

const ImportedChatSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sender: { type: String, enum: ["user", "ai"], required: true },
    text: { type: String, required: true },
    time: { type: Date, required: true },
    source: { type: String, default: "unknown" }
  },
  { timestamps: true }
);

ImportedChatSchema.index({ userId: 1 });
ImportedChatSchema.index({ text: 1, time: 1 }); // For quick duplicate checks

export const ImportedChat = model("ImportedChat", ImportedChatSchema);
