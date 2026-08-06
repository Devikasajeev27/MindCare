import { User } from "../../models/User.ts";
import { Therapist } from "../../models/Therapist.ts";
import { SPECIALIZATIONS, LANGUAGES } from "./constants.ts";

export async function generateTherapists(targetCount = 25) {
  console.log("Checking Therapists collection...");
  const therapistsUsers = await User.find({ role: "therapist" });
  const existingTherapistsListings = await Therapist.find({});
  
  if (therapistsUsers.length === 0) {
    console.log("No therapist users found. Skipping therapist directory listings.");
    return existingTherapistsListings;
  }

  const existingCount = existingTherapistsListings.length;

  if (existingCount >= targetCount) {
    console.log(`Therapists collection satisfies target count (${existingCount}/${targetCount}).`);
    return existingTherapistsListings;
  }

  const needed = targetCount - existingCount;
  console.log(`Seeding ${needed} additional Therapist profiles...`);
  const payloads: any[] = [];

  for (let i = 0; i < needed; i++) {
    const user = therapistsUsers[i % therapistsUsers.length];
    
    // Check if listing already exists for this user to keep it unique
    const isListed = existingTherapistsListings.some(t => t.userId?.toString() === user._id.toString()) ||
                     payloads.some(p => p.userId?.toString() === user._id.toString());
                     
    if (!isListed) {
      const spec = [
        SPECIALIZATIONS[i % SPECIALIZATIONS.length],
        SPECIALIZATIONS[(i + 3) % SPECIALIZATIONS.length]
      ];

      // Dynamically generate correct matching review counts and review objects
      const targetReviewCount = 15 + i * 4;
      const reviews = [];
      let ratingSum = 0;
      const reviewComments = [
        "Truly a professional listener. Extremely structured guidance.",
        "Excellent exercises provided. Made a huge difference in my routine.",
        "Very supportive and empathetic throughout our sessions.",
        "Highly recommended for managing daily anxiety and work stress.",
        "Provided practical tools that I still use every single day.",
        "Gentle, validating, and helped me build better boundary habits."
      ];
      const reviewers = ["Sneha V.", "Akhil B.", "Meera P.", "Rahul M.", "Karan S.", "Deepika K.", "Amit S.", "Ananya R."];

      for (let j = 0; j < targetReviewCount; j++) {
        // Distribute ratings to achieve an average between 4.6 and 4.9
        const score = (j % 6 === 0) ? 4 : 5;
        ratingSum += score;
        reviews.push({
          rating: score,
          text: reviewComments[j % reviewComments.length],
          reviewerName: reviewers[(j + i) % reviewers.length],
          date: new Date(Date.now() - (j + 1) * 3 * 24 * 60 * 60 * 1000)
        });
      }

      const calculatedRating = Number((ratingSum / targetReviewCount).toFixed(1));

      payloads.push({
        name: user.name,
        title: i % 2 === 0 ? "Clinical Psychologist (M.Phil)" : "Licensed Mental Health Counselor",
        specializations: spec,
        rating: calculatedRating,
        reviewCount: targetReviewCount,
        yearsExperience: 5 + (i % 15),
        consultationFee: 60000 + (i % 6) * 10000, // Indian Paise
        availability: "Available Today",
        avatar: user.avatar || [
          "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=200",
          "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=200",
          "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=200",
          "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=200",
          "https://images.unsplash.com/photo-1591604021695-0c69b7c05981?auto=format&fit=crop&q=80&w=200"
        ][i % 5],
        userId: user._id,
        qualification: i % 2 === 0 ? "M.Phil in Clinical Psychology" : "M.Sc. in Counseling Psychology",
        registrationNumber: `RCI-REG-${20000 + i}`,
        licenseNumber: `LIC-MH-${30000 + i}`,
        languages: ["English", "Hindi", LANGUAGES[i % LANGUAGES.length]],
        patientsCount: 20 + i * 2,
        reviews: reviews
      });
    }
  }

  if (payloads.length > 0) {
    await Therapist.insertMany(payloads);
  }

  console.log(`Seeding complete. Therapist profiles: ${await Therapist.countDocuments()}`);
  return await Therapist.find({});
}
