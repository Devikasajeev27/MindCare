import { Schema, model } from "mongoose";

const BlockedUsersSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blockedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true },
  },
  { timestamps: true }
);

export const BlockedUsers = model("BlockedUsers", BlockedUsersSchema);
