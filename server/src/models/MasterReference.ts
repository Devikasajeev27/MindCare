import mongoose, { Schema, Document } from "mongoose";

export interface IMasterReference extends Document {
  type: "reward" | "achievement" | "mood_category" | "emergency_helpline" | "wellness_tip" | "notification_template" | "city_reference";
  code: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  metadata?: Record<string, any>;
  language?: string;
  isSystemDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MasterReferenceSchema: Schema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["reward", "achievement", "mood_category", "emergency_helpline", "wellness_tip", "notification_template", "city_reference"],
      index: true,
    },
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "General" },
    icon: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    language: { type: String, default: "en" },
    isSystemDefault: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const MasterReference = mongoose.model<IMasterReference>("MasterReference", MasterReferenceSchema);
