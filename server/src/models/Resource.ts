import { Schema, model } from "mongoose";

const ResourceSchema = new Schema(
  {
    type: { type: String, enum: ["video", "article", "audio", "exercise"], required: true },
    category: { type: String, required: true },
    image: { type: String, required: true },
    tag: { type: String, required: true },
    title: { type: String, required: true },
    meta: { type: String, required: true },
    // Optional long-form material shown in the therapist resource reader.
    // Existing resources remain valid and render their database metadata only.
    content: { type: String, default: "" },
    mediaUrl: { type: String, default: "" },
    rating: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ResourceSchema.index({ title: "text", tag: "text", category: "text" });

export const Resource = model("Resource", ResourceSchema);
