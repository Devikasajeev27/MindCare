import { MasterReference } from "../../models/MasterReference.ts";

export async function generateMasterReferences() {
  console.log("Checking MasterReference collection...");
  const count = await MasterReference.countDocuments();
  if (count > 0) {
    console.log(`MasterReference collection already populated (${count} entries).`);
    return;
  }

  console.log("Seeding MasterReference dataset with Indian master definitions...");

  const data = [
    // ── REWARDS MASTER ──
    { type: "reward", code: "reward_daily_mood", name: "Daily Mood Check-in", description: "Log your daily mood to earn wellness XP", category: "Daily", icon: "SmilePlus", metadata: { xp: 10 } },
    { type: "reward", code: "reward_7day_streak", name: "7 Day Streak", description: "Maintain a 7-day active wellness streak", category: "Streak", icon: "Flame", metadata: { xp: 50 } },
    { type: "reward", code: "reward_30day_streak", name: "30 Day Streak", description: "Achieve a full 30-day wellness streak", category: "Streak", icon: "Award", metadata: { xp: 200 } },
    { type: "reward", code: "reward_journal_beginner", name: "Journal Beginner", description: "Write your first reflection journal entry", category: "Journal", icon: "BookOpen", metadata: { xp: 20 } },
    { type: "reward", code: "reward_mindfulness_champ", name: "Mindfulness Champion", description: "Complete 5 guided breathing or meditation sessions", category: "Mindfulness", icon: "Sparkles", metadata: { xp: 40 } },
    { type: "reward", code: "reward_convo_starter", name: "Conversation Starter", description: "Start your first chat with MindCare AI Companion", category: "AI Chat", icon: "MessageSquare", metadata: { xp: 15 } },
    { type: "reward", code: "reward_wellness_explorer", name: "Wellness Explorer", description: "Explore 3 wellness articles or exercises", category: "Exploration", icon: "Compass", metadata: { xp: 30 } },
    { type: "reward", code: "reward_growth_champion", name: "Growth Champion", description: "Reach Level 5 in MindCare Wellness", category: "Growth", icon: "TrendingUp", metadata: { xp: 100 } },
    { type: "reward", code: "reward_consistency_master", name: "Consistency Master", description: "Log 50 total mood entries in MindCare", category: "Consistency", icon: "ShieldCheck", metadata: { xp: 250 } },

    // ── ACHIEVEMENTS MASTER ──
    { type: "achievement", code: "ach_first_mood", name: "First Mood Logged", description: "Recorded your very first mood check-in", category: "Milestone", icon: "CheckCircle2" },
    { type: "achievement", code: "ach_first_journal", name: "First Journal", description: "Created your first reflective journal entry", category: "Milestone", icon: "FileText" },
    { type: "achievement", code: "ach_first_ai_chat", name: "First AI Chat", description: "Had your first conversation with AI Companion", category: "AI Support", icon: "Bot" },
    { type: "achievement", code: "ach_first_therapist_booking", name: "First Therapist Booking", description: "Scheduled a professional therapy consultation", category: "Therapy", icon: "Stethoscope" },
    { type: "achievement", code: "ach_7day_mood_streak", name: "7 Day Mood Streak", description: "Logged mood for 7 consecutive days", category: "Streak", icon: "Flame" },
    { type: "achievement", code: "ach_30day_mood_streak", name: "30 Day Mood Streak", description: "Logged mood for 30 consecutive days", category: "Streak", icon: "Star" },
    { type: "achievement", code: "ach_50_conversations", name: "50 Conversations", description: "Engaged in 50 supportive conversations", category: "Engagement", icon: "MessageCircle" },
    { type: "achievement", code: "ach_100_mood_entries", name: "100 Mood Entries", description: "Accumulated 100 total mood check-ins", category: "Mastery", icon: "Award" },
    { type: "achievement", code: "ach_mindfulness_completed", name: "Mindfulness Challenge Completed", description: "Completed a 7-day guided breathing challenge", category: "Mindfulness", icon: "Heart" },

    // ── MOOD CATEGORIES ──
    { type: "mood_category", code: "mood_happy", name: "Happy", description: "Feeling joyful, delighted, and cheerful", category: "Positive", icon: "😄", metadata: { rating: 5, score: 100 } },
    { type: "mood_category", code: "mood_calm", name: "Calm", description: "Feeling peaceful, relaxed, and serene", category: "Positive", icon: "😊", metadata: { rating: 5, score: 90 } },
    { type: "mood_category", code: "mood_excited", name: "Excited", description: "Feeling energetic, enthusiastic, and eager", category: "Positive", icon: "🎉", metadata: { rating: 5, score: 95 } },
    { type: "mood_category", code: "mood_hopeful", name: "Hopeful", description: "Feeling optimistic about the future", category: "Positive", icon: "🌟", metadata: { rating: 4, score: 80 } },
    { type: "mood_category", code: "mood_neutral", name: "Neutral", description: "Feeling balanced, steady, or indifferent", category: "Neutral", icon: "😐", metadata: { rating: 3, score: 60 } },
    { type: "mood_category", code: "mood_tired", name: "Tired", description: "Feeling physically or mentally low on energy", category: "Low Energy", icon: "😴", metadata: { rating: 2, score: 40 } },
    { type: "mood_category", code: "mood_stressed", name: "Stressed", description: "Feeling pressure from work, study, or life", category: "Negative", icon: "😰", metadata: { rating: 2, score: 35 } },
    { type: "mood_category", code: "mood_anxious", name: "Anxious", description: "Feeling worried, nervous, or uneasy", category: "Negative", icon: "😟", metadata: { rating: 2, score: 30 } },
    { type: "mood_category", code: "mood_lonely", name: "Lonely", description: "Feeling isolated or lacking social connection", category: "Negative", icon: "🌧️", metadata: { rating: 2, score: 25 } },
    { type: "mood_category", code: "mood_sad", name: "Sad", description: "Feeling down, sorrowful, or unhappy", category: "Negative", icon: "😢", metadata: { rating: 1, score: 20 } },
    { type: "mood_category", code: "mood_overwhelmed", name: "Overwhelmed", description: "Feeling burdened by too many demands", category: "Negative", icon: "🤯", metadata: { rating: 1, score: 15 } },
    { type: "mood_category", code: "mood_burnout", name: "Burnout", description: "Feeling exhausted and emotionally drained", category: "Negative", icon: "🕯️", metadata: { rating: 1, score: 10 } },
    { type: "mood_category", code: "mood_angry", name: "Angry", description: "Feeling frustrated, annoyed, or enraged", category: "Negative", icon: "😠", metadata: { rating: 1, score: 15 } },
    { type: "mood_category", code: "mood_confused", name: "Confused", description: "Feeling uncertain or lacking clarity", category: "Neutral", icon: "🤔", metadata: { rating: 3, score: 50 } },

    // ── EMERGENCY HELPLINES (INDIAN REFERENCE DATA) ──
    { type: "emergency_helpline", code: "helpline_112", name: "National Emergency Helpline", description: "24/7 Police, Fire, and Ambulance Emergency Services", category: "Government", icon: "PhoneCall", metadata: { phone: "112", country: "India", countryCode: "IN", tollFree: true } },
    { type: "emergency_helpline", code: "helpline_tele_manas", name: "Tele-MANAS Mental Health Helpline", description: "National Tele Mental Health Programme of India", category: "Mental Health", icon: "HeartHandshake", metadata: { phone: "14416", altPhone: "1800-891-4416", country: "India", countryCode: "IN", tollFree: true } },
    { type: "emergency_helpline", code: "helpline_kiran", name: "KIRAN Mental Health Helpline", description: "Ministry of Social Justice & Empowerment Helpline", category: "Mental Health", icon: "Shield", metadata: { phone: "1800-599-0019", country: "India", countryCode: "IN", tollFree: true } },
    { type: "emergency_helpline", code: "helpline_aasra", name: "AASRA Suicide Prevention Helpline", description: "24/7 Crisis Support & Suicide Prevention", category: "Crisis Intervention", icon: "LifeBuoy", metadata: { phone: "91-9820466726", altPhone: "022-27546669", country: "India", countryCode: "IN", tollFree: false } },
    { type: "emergency_helpline", code: "helpline_vandrevala", name: "Vandrevala Foundation Helpline", description: "Free Mental Health Counseling and Crisis Support", category: "Crisis Intervention", icon: "Phone", metadata: { phone: "9999-666-555", country: "India", countryCode: "IN", tollFree: true } },
    { type: "emergency_helpline", code: "helpline_sneha", name: "Sneha India Crisis Helpline", description: "Emotional Support & Suicide Prevention Services", category: "Crisis Intervention", icon: "Heart", metadata: { phone: "044-24640050", country: "India", countryCode: "IN", tollFree: false } },

    // ── WELLNESS TIPS ──
    { type: "wellness_tip", code: "tip_walk", name: "Take a Short Walk", description: "Step outside for a 15-minute gentle walk to refresh your mind and boost serotonin.", category: "Physical", icon: "Footprints" },
    { type: "wellness_tip", code: "tip_water", name: "Hydrate & Refresh", description: "Drink a glass of water or warm herbal tea to maintain focus and physical balance.", category: "Physical", icon: "Droplets" },
    { type: "wellness_tip", code: "tip_pranayama", name: "Practice Deep Breathing", description: "Perform 4-7-8 Pranayama breathing to immediately calm your nervous system.", category: "Mindfulness", icon: "Wind" },
    { type: "wellness_tip", code: "tip_family", name: "Connect with Loved Ones", description: "Spend quality time with family or talk to a trusted friend to feel supported.", category: "Social", icon: "Users" },
    { type: "wellness_tip", code: "tip_music", name: "Listen to Calming Music", description: "Tune into gentle acoustic, classical, or ambient soundscapes to relieve stress.", category: "Relaxation", icon: "Music" },
    { type: "wellness_tip", code: "tip_detox", name: "Digital Detox Break", description: "Take a 30-minute break from social media screens before heading to bed.", category: "Digital Balance", icon: "SmartphoneOff" },
    { type: "wellness_tip", code: "tip_sleep", name: "Maintain Sleep Hygiene", description: "Keep a regular sleep schedule and aim for 7-8 hours of restful sleep every night.", category: "Sleep", icon: "Moon" },

    // ── NOTIFICATION TEMPLATES ──
    { type: "notification_template", code: "notif_mood_reminder", name: "Mood Reminder", description: "Time for your daily mood check-in! How are you feeling today?", category: "Reminder", metadata: { title: "Daily Mood Check-in 🌿", type: "mood" } },
    { type: "notification_template", code: "notif_journal_reminder", name: "Journal Reminder", description: "Reflect on your day with a quick journal entry.", category: "Reminder", metadata: { title: "Reflection Time 📖", type: "journal" } },
    { type: "notification_template", code: "notif_appointment_reminder", name: "Therapist Appointment Reminder", description: "Reminder: You have an upcoming session scheduled.", category: "Appointment", metadata: { title: "Upcoming Session 🩺", type: "appointment" } },
    { type: "notification_template", code: "notif_companion_available", name: "Companion Available", description: "Verified peer companions are online and ready to listen.", category: "Peer Support", metadata: { title: "Peer Support Ready 🤝", type: "companion" } },
    { type: "notification_template", code: "notif_achievement_unlocked", name: "Achievement Unlocked", description: "Congratulations! You unlocked a new wellness milestone.", category: "Achievement", metadata: { title: "Achievement Unlocked! 🏆", type: "achievement" } },
    { type: "notification_template", code: "notif_weekly_summary", name: "Weekly Wellness Summary", description: "Your weekly mood & wellness report is ready to view.", category: "Report", metadata: { title: "Weekly Report Ready 📊", type: "report" } },

    // ── CITY REFERENCES ──
    { type: "city_reference", code: "city_kochi", name: "Kochi", category: "City", metadata: { state: "Kerala", country: "India", pinCode: "682001", dialCode: "+91" } },
    { type: "city_reference", code: "city_tvm", name: "Thiruvananthapuram", category: "City", metadata: { state: "Kerala", country: "India", pinCode: "695001", dialCode: "+91" } },
    { type: "city_reference", code: "city_kozhikode", name: "Kozhikode", category: "City", metadata: { state: "Kerala", country: "India", pinCode: "673001", dialCode: "+91" } },
    { type: "city_reference", code: "city_bengaluru", name: "Bengaluru", category: "City", metadata: { state: "Karnataka", country: "India", pinCode: "560001", dialCode: "+91" } },
    { type: "city_reference", code: "city_chennai", name: "Chennai", category: "City", metadata: { state: "Tamil Nadu", country: "India", pinCode: "600001", dialCode: "+91" } },
    { type: "city_reference", code: "city_hyderabad", name: "Hyderabad", category: "City", metadata: { state: "Telangana", country: "India", pinCode: "500001", dialCode: "+91" } },
    { type: "city_reference", code: "city_mumbai", name: "Mumbai", category: "City", metadata: { state: "Maharashtra", country: "India", pinCode: "400001", dialCode: "+91" } },
    { type: "city_reference", code: "city_delhi", name: "Delhi", category: "City", metadata: { state: "Delhi", country: "India", pinCode: "110001", dialCode: "+91" } },
    { type: "city_reference", code: "city_pune", name: "Pune", category: "City", metadata: { state: "Maharashtra", country: "India", pinCode: "411001", dialCode: "+91" } },
    { type: "city_reference", code: "city_coimbatore", name: "Coimbatore", category: "City", metadata: { state: "Tamil Nadu", country: "India", pinCode: "641001", dialCode: "+91" } },
  ];

  await MasterReference.insertMany(data);
  console.log(`✓ MasterReference populated successfully with ${data.length} Indian master definitions.`);
}
