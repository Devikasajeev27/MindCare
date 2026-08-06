import { Schema, model } from "mongoose";

const FavoritesSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    favoriteCompanionId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Favorites = model("Favorites", FavoritesSchema);
