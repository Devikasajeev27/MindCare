import { User } from "../models/User.ts";

export interface NearbyFacility {
  name: string;
  type: "therapist" | "hospital" | "helpline" | "mental_health_centre";
  distance: string;
  phone: string;
  address?: string;
  mapsUrl?: string;
}

// Fixed standard crisis helplines for mental health in India (Fallback & support)
export const CRISIS_HELPLINES: NearbyFacility[] = [
  {
    name: "KIRAN Mental Health Helpline",
    type: "helpline",
    distance: "Always available",
    phone: "1800-599-0019",
    address: "Govt. of India, Ministry of Social Justice and Empowerment",
  },
  {
    name: "Vandrevala Foundation Helpline",
    type: "helpline",
    distance: "Always available",
    phone: "+91 9999 666 555",
    address: "24/7 Crisis Support",
    mapsUrl: "https://www.vandrevalafoundation.com",
  },
  {
    name: "iCALL Helpline (TISS)",
    type: "helpline",
    distance: "Mon-Sat 8AM-10PM",
    phone: "+91 91529 87821",
    address: "Tata Institute of Social Sciences, Mumbai",
  },
  {
    name: "Tele-MANAS",
    type: "helpline",
    distance: "Always available",
    phone: "14416",
    address: "National Tele-Mental Health Programme, NIMHANS",
  }
];

export class LocationService {
  /**
   * Find nearest therapists and hospitals relative to user's coordinates.
   * If coordinates are not provided, returns general list.
   */
  static async findNearbySupport(
    lat?: number,
    lng?: number
  ): Promise<NearbyFacility[]> {
    const facilities: NearbyFacility[] = [];

    try {
      // Find all approved therapists in the database
      const therapists = await User.find({ role: "therapist", status: "approved" }).limit(5);
      
      therapists.forEach((t, i) => {
        // Mock a distance calculation based on therapist location or index
        const distanceVal = lat && lng ? (1.2 + i * 1.5).toFixed(1) : (3.5 + i * 2.1).toFixed(1);
        
        facilities.push({
          name: `Dr. ${t.name}`,
          type: "therapist",
          distance: `${distanceVal} km`,
          phone: t.phone || "N/A",
          address: t.address || "MindCare Clinic, Bangalore",
          mapsUrl: lat && lng ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.name + " " + (t.address || "Clinic"))}` : undefined
        });
      });
    } catch (err) {
      console.error("[LocationService] Error searching nearby therapists:", err);
    }

    // Add static/common nearby hospitals/centres for mock demonstration purposes
    if (lat && lng) {
      facilities.push({
        name: "National Institute of Mental Health and Neurosciences (NIMHANS)",
        type: "hospital",
        distance: "4.8 km",
        phone: "080-26995000",
        address: "Hosur Road, Bengaluru, Karnataka 560029",
        mapsUrl: "https://www.google.com/maps/place/NIMHANS",
      });
      facilities.push({
        name: "St. John's Medical College Hospital",
        type: "hospital",
        distance: "6.2 km",
        phone: "080-22065000",
        address: "Sarjapur Road, John Nagar, Koramangala, Bengaluru, Karnataka 560034",
        mapsUrl: "https://www.google.com/maps/place/St.+John's+Medical+College+Hospital",
      });
    } else {
      facilities.push({
        name: "Regional Mental Health Hospital Center",
        type: "mental_health_centre",
        distance: "Contact local services",
        phone: "112",
        address: "National Emergency Response System",
      });
    }

    // Combine database results with general helpline fallbacks
    return [...facilities, ...CRISIS_HELPLINES];
  }

  /**
   * Generates a Google Maps link for user's coordinates.
   */
  static getGoogleMapsLink(lat?: number, lng?: number): string {
    if (!lat || !lng) return "Location not reported";
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
}
