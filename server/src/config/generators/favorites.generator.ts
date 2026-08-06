import { User } from "../../models/User.ts";
import { Favorites } from "../../models/Favorites.ts";

export async function generateFavorites(targetCount = 400) {
  console.log("Checking Favorites collection...");
  const clients = await User.find({ role: "user", verifiedCompanion: false });
  const companions = await User.find({ verifiedCompanion: true });

  if (clients.length === 0 || companions.length === 0) {
    console.log("No clients or companions found. Skipping favorites generation.");
    return;
  }

  const existingCount = await Favorites.countDocuments();
  if (existingCount >= targetCount) {
    console.log(`Favorites collection satisfies target count (${existingCount}/${targetCount}).`);
    return;
  }

  const needed = targetCount - existingCount;
  console.log(`Seeding ${needed} additional Favorites entries...`);
  const favs: any[] = [];

  for (let i = 0; i < needed; i++) {
    const client = clients[i % clients.length];
    const companion = companions[i % companions.length];
    
    // Check uniqueness to prevent duplicate keys
    const isSaved = favs.some(f => f.userId.toString() === client._id.toString() &&
                                  f.favoriteCompanionId.toString() === companion._id.toString());
    
    if (!isSaved) {
      favs.push({
        userId: client._id,
        favoriteCompanionId: companion._id
      });
    }
  }

  if (favs.length > 0) {
    await Favorites.insertMany(favs);
  }

  console.log(`Seeding complete. Favorites count: ${await Favorites.countDocuments()}`);
}
