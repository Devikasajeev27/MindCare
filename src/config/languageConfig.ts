import type { ReactNode } from "react";

export type Lang = "en" | "es" | "fr" | "ar" | "hi";

export const LANGUAGES: { code: Lang; label: string; flag: string; rtl?: boolean }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦", rtl: true },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
];

export const AI_GREETINGS: Record<Lang, string> = {
  en: "Hi! I'm MindCare AI. How are you feeling today?",
  es: "¡Hola! Soy MindCare AI. ¿Cómo te sientes hoy?",
  fr: "Bonjour ! Je suis MindCare AI. Comment vous sentez-vous aujourd'hui ?",
  ar: "مرحباً! أنا MindCare AI. كيف تشعر اليوم؟",
  hi: "नमस्ते! मैं MindCare AI हूँ। आज आप कैसा महसूस कर रहे हैं?",
};

export const AI_RESPONSES_I18N: Record<Lang, string[]> = {
  en: [
    "I understand how you feel. You're not alone in this. Would you like to try a breathing exercise?",
    "Thank you for sharing. Your feelings are completely valid. What's been weighing on you most?",
    "I'm here for you. Let's take this one step at a time together.",
  ],
  es: [
    "Entiendo cómo te sientes. No estás solo en esto. ¿Te gustaría probar un ejercicio de respiración?",
    "Gracias por compartir. Tus sentimientos son completamente válidos. ¿Qué te ha pesado más?",
    "Estoy aquí para ti. Vamos a tomar esto paso a paso juntos.",
  ],
  fr: [
    "Je comprends ce que vous ressentez. Vous n'êtes pas seul. Voulez-vous essayer un exercice de respiration ?",
    "Merci de partager. Vos sentiments sont tout à fait valides. Qu'est-ce qui vous pèse le plus ?",
    "Je suis là pour vous. Prenons les choses étape par étape ensemble.",
  ],
  ar: [
    "أفهم كيف تشعر. أنت لست وحدك في هذا. هل تريد تجربة تمرين التنفس؟",
    "شكراً لمشاركتك. مشاعرك صحيحة تماماً. ما الذي يثقل عليك أكثر؟",
    "أنا هنا من أجلك. لنأخذ هذا خطوة بخطوة معاً.",
  ],
  hi: [
    "मैं समझता हूँ आप कैसा महसूस कर रहे हैं। आप इसमें अकेले नहीं हैं। क्या आप एक सांस लेने का व्यायाम करना चाहेंगे?",
    "साझा करने के लिए धन्यवाद। आपकी भावनाएँ बिल्कुल वैध हैं। आपको सबसे ज़्यादा क्या परेशान कर रहा है?",
    "मैं आपके लिए यहाँ हूँ। आइए इसे एक-एक कदम मिलकर करें।",
  ],
};

export const CRISIS_RESPONSES_I18N: Record<Lang, string> = {
  en: "I'm really concerned about what you shared. Please reach out to 988 Suicide & Crisis Lifeline (call or text 988). You matter deeply.",
  es: "Me preocupa mucho lo que compartiste. Por favor contacta al 988 Lifeline (llama o escribe al 988). Eres muy importante.",
  fr: "Ce que vous avez partagé me préoccupe vraiment. Veuillez contacter le 3114 (numéro national de prévention du suicide). Vous comptez énormément.",
  ar: "أنا قلق جداً مما شاركته. يرجى التواصل مع خط الأزمات. أنت مهم جداً.",
  hi: "आपने जो साझा किया वह मुझे बहुत चिंतित करता है। कृपया iCall हेल्पलाइन 9152987821 से संपर्क करें। आप बहुत महत्वपूर्ण हैं।",
};

export const LANGUAGE_STORAGE_KEY = "mc_lang";

export const DEFAULT_LANGUAGE: Lang = "en";

