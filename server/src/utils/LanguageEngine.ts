export class LanguageEngine {
  // Supported languages list
  public static SUPPORTED = [
    "en", "ml", "ta", "hi", "ar", "fr", "es", "de", "pt", "it", "ja", "zh", "ko", "ru",
    "manglish", "tanglish", "hinglish"
  ];

  // Robust vocabulary banks for Romanized dialects
  private static MANGLISH_KEYWORDS = [
    "enikk", "enikka", "vayya", "vayyann", "sugam", "sugamano", "njan", "njanum", "enth", "cheyya", 
    "cheyyanam", "kazhicho", "kazhichu", "poyi", "poyittu", "ivide", "varum", "enthada", "polichu", 
    "nalla", "aano", "alla", "athe", "chumma", "evide", "eppo", "ippol", "eppol", "varumo", "pinne", 
    "athentha", "kure", "engane", "innu", "vallathe", "poda", "machane", "aanu", "cheyyunnu", "parayam", 
    "parayu", "nanni", "manasilayi", "sanki", "nannayi", "sugamalle"
  ];

  private static TANGLISH_KEYWORDS = [
    "naan", "naanum", "romba", "enaku", "enakkum", "bayama", "iruku", "irukku", "saptiya", "epadi", 
    "iruka", "irukinga", "panra", "panni", "poda", "unna", "nalla", "illai", "theriyum", "venum", 
    "ama", "illa", "yen", "eppadi", "nanba", "thala", "epdi", "sapad", "sapta", "saptacha", "mudiyala", 
    "mudiyum", "paduthu", "iruken", "pannunga", "solunga", "kavalapadatha", "kavala"
  ];

  private static HINGLISH_KEYWORDS = [
    "mujhe", "main", "bahut", "bohot", "hu", "hoon", "yaar", "kya", "karu", "hai", "tum", 
    "ho", "raha", "kar", "se", "ko", "nhi", "nahi", "aap", "accha", "acha", "hoga", "kaise", 
    "bhai", "sab", "theek", "thik", "chal", "karo", "hua", "gya", "rha", "rhi", "gaya", "gaye", 
    "dost", "samajh", "sath", "kuch", "aur", "bhi", "ab", "toh", "mera", "meri", 
    "tere", "teri", "apna", "apni"
  ];

  /**
   * Normalizes language codes into supported keys
   */
  public static normalizeLanguage(lang: string): string {
    const clean = (lang || "").toLowerCase().trim();
    if (this.SUPPORTED.includes(clean)) {
      return clean;
    }
    // Mapping matches
    if (clean.includes("malayalam")) return "ml";
    if (clean.includes("tamil")) return "ta";
    if (clean.includes("hindi")) return "hi";
    if (clean.includes("arabic")) return "ar";
    if (clean.includes("french")) return "fr";
    if (clean.includes("spanish")) return "es";
    if (clean.includes("german")) return "de";
    if (clean.includes("portuguese")) return "pt";
    if (clean.includes("italian")) return "it";
    if (clean.includes("japanese")) return "ja";
    if (clean.includes("chinese")) return "zh";
    if (clean.includes("korean")) return "ko";
    if (clean.includes("russian")) return "ru";
    if (clean.includes("tanglish")) return "tanglish";
    if (clean.includes("manglish")) return "manglish";
    if (clean.includes("hinglish")) return "hinglish";
    return "en";
  }

  /**
   * Identifies native Unicode scripts in the input text
   */
  public static detectScript(text: string): string {
    if (/[\u0D00-\u0D7F]/.test(text)) return "ml"; // Malayalam
    if (/[\u0B80-\u0BFF]/.test(text)) return "ta"; // Tamil
    if (/[\u0900-\u097F]/.test(text)) return "hi"; // Hindi (Devanagari)
    if (/[\u0600-\u06FF]/.test(text)) return "ar"; // Arabic
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) return "ja"; // Japanese
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh"; // Chinese
    if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return "ko"; // Korean
    if (/[\u0400-\u04FF]/.test(text)) return "ru"; // Russian
    return "latin";
  }

  /**
   * Detects Romanized mixed dialects based on vocabulary bank scores
   */
  public static detectRomanizedLanguage(text: string): string {
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, " ");
    const words = cleanText.split(/\s+/).filter(Boolean);

    let manglishScore = 0;
    let tanglishScore = 0;
    let hinglishScore = 0;

    for (const word of words) {
      if (this.MANGLISH_KEYWORDS.includes(word)) manglishScore++;
      if (this.TANGLISH_KEYWORDS.includes(word)) tanglishScore++;
      if (this.HINGLISH_KEYWORDS.includes(word)) hinglishScore++;
    }

    const maxScore = Math.max(manglishScore, tanglishScore, hinglishScore);

    if (maxScore > 0) {
      if (maxScore === manglishScore) return "manglish";
      if (maxScore === tanglishScore) return "tanglish";
      if (maxScore === hinglishScore) return "hinglish";
    }

    return "en";
  }

  /**
   * Checks if the language is a mixed Romanized format
   */
  public static detectMixedLanguage(text: string): boolean {
    const romanized = this.detectRomanizedLanguage(text);
    return ["manglish", "tanglish", "hinglish"].includes(romanized);
  }

  /**
   * Central language detection router
   */
  public static detectLanguage(text: string): string {
    const lower = text.toLowerCase();
    
    // Explicit override checks
    if (lower.includes("reply in english") || lower.includes("translate into english") || lower.includes("translate to english")) {
      return "en";
    }

    // 1. Script checks
    const script = this.detectScript(text);
    if (script !== "latin") {
      return script;
    }

    // 2. Romanized dialect checks
    const romanized = this.detectRomanizedLanguage(text);
    if (romanized !== "en") {
      return romanized;
    }

    // 3. European vocabulary cues
    if (lower.startsWith("bonjour") || lower.includes("comment ça va") || lower.includes("fatigué")) return "fr";
    if (lower.startsWith("hola") || lower.includes("cómo estás") || lower.includes("estoy triste")) return "es";
    if (lower.startsWith("hallo") || lower.includes("wie gehts") || lower.includes("gestresst")) return "de";
    if (lower.startsWith("ciao") || lower.includes("come stai")) return "it";
    if (lower.startsWith("olá") || lower.includes("tudo bem")) return "pt";

    return "en";
  }

  /**
   * Response language verification rule
   */
  public static validateResponseLanguage(text: string, expectedLang: string): boolean {
    const containsMalayalam = /[\u0D00-\u0D7F]/.test(text);
    const containsTamil = /[\u0B80-\u0BFF]/.test(text);
    const containsHindi = /[\u0900-\u097F]/.test(text);
    const containsArabic = /[\u0600-\u06FF]/.test(text);
    const containsJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    const containsChinese = /[\u4E00-\u9FFF]/.test(text);
    const containsKorean = /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text);
    const containsRussian = /[\u0400-\u04FF]/.test(text);

    switch (expectedLang) {
      case "ml": return containsMalayalam;
      case "ta": return containsTamil;
      case "hi": return containsHindi;
      case "ar": return containsArabic;
      case "ja": return containsJapanese;
      case "zh": return containsChinese;
      case "ko": return containsKorean;
      case "ru": return containsRussian;
      
      // Romanized dialects or English/European scripts must NOT contain regional native symbols
      case "manglish": {
        if (containsMalayalam || containsTamil || containsHindi || containsArabic || containsJapanese || containsChinese || containsKorean || containsRussian) {
          return false;
        }
        // Ensure it contains at least one Manglish vocabulary indicator to avoid pure English fallback
        const lower = text.toLowerCase();
        return this.MANGLISH_KEYWORDS.some(word => new RegExp(`\\b${word}\\b`).test(lower)) || lower.includes("aanu") || lower.includes("sugam");
      }
      case "tanglish": {
        if (containsMalayalam || containsTamil || containsHindi || containsArabic || containsJapanese || containsChinese || containsKorean || containsRussian) {
          return false;
        }
        // Ensure it contains at least one Tanglish vocabulary indicator to avoid pure English fallback
        const lower = text.toLowerCase();
        return this.TANGLISH_KEYWORDS.some(word => new RegExp(`\\b${word}\\b`).test(lower)) || lower.includes("iruku") || lower.includes("romba");
      }
      case "hinglish": {
        if (containsMalayalam || containsTamil || containsHindi || containsArabic || containsJapanese || containsChinese || containsKorean || containsRussian) {
          return false;
        }
        // Ensure it contains at least one Hinglish vocabulary indicator to avoid pure English fallback
        const lower = text.toLowerCase();
        return this.HINGLISH_KEYWORDS.some(word => new RegExp(`\\b${word}\\b`).test(lower)) || lower.includes("hai") || lower.includes("kya");
      }
      case "en":
      case "fr":
      case "es":
      case "de":
      case "pt":
      case "it":
        return !containsMalayalam && !containsTamil && !containsHindi && !containsArabic &&
               !containsJapanese && !containsChinese && !containsKorean && !containsRussian;
      
      default:
        return true;
    }
  }

  /**
   * High priority prompt commands block creation
   */
  public static buildLanguageInstruction(lang: string): string {
    const normalized = this.normalizeLanguage(lang);
    
    let detail = "";
    switch (normalized) {
      case "ml":
        detail = "Malayalam ONLY (using Malayalam native script). Do not use English script, do not translate, do not speak English.";
        break;
      case "ta":
        detail = "Tamil ONLY (using Tamil native script). Do not use English script, do not translate, do not speak English.";
        break;
      case "hi":
        detail = "Hindi ONLY (using Devanagari native script). Do not use English script, do not translate, do not speak English.";
        break;
      case "ar":
        detail = "Arabic ONLY (using Arabic native script). Do not translate, do not speak English.";
        break;
      case "fr":
        detail = "French ONLY. Do not translate, do not speak English.";
        break;
      case "es":
        detail = "Spanish ONLY. Do not translate, do not speak English.";
        break;
      case "de":
        detail = "German ONLY. Do not translate, do not speak English.";
        break;
      case "pt":
        detail = "Portuguese ONLY. Do not translate, do not speak English.";
        break;
      case "it":
        detail = "Italian ONLY. Do not translate, do not speak English.";
        break;
      case "ja":
        detail = "Japanese ONLY (using Japanese kanji/kana script). Do not translate, do not speak English.";
        break;
      case "zh":
        detail = "Chinese ONLY (using Hanzi script). Do not translate, do not speak English.";
        break;
      case "ko":
        detail = "Korean ONLY (using Hangul script). Do not translate, do not speak English.";
        break;
      case "ru":
        detail = "Russian ONLY (using Cyrillic script). Do not translate, do not speak English.";
        break;
      case "tanglish":
        detail = "Tanglish style (Tamil words transliterated in Latin/Roman English alphabet, mixed naturally with English). You MUST use Tanglish words like 'naan', 'romba', 'tired', 'enaku', 'iruku', 'epadi', 'saptiya' in your sentence. Do not use Tamil script. Do not write pure English.";
        break;
      case "manglish":
        detail = "Manglish style (Malayalam words transliterated in Latin/Roman English alphabet, mixed naturally with English). You MUST use Manglish words like 'enikk', 'vayya', 'sugam', 'njan', 'enth', 'cheyya', 'aano', 'aanu' in your sentence. Do not use Malayalam script. Do not write pure English.";
        break;
      case "hinglish":
        detail = "Hinglish style (Hindi words transliterated in Latin/Roman English alphabet, mixed naturally with English). You MUST use Hinglish words like 'mujhe', 'yaar', 'kya', 'karu', 'hai', 'ho', 'raha', 'nhi', 'kaise', 'sab', 'theek' in your sentence. Do not use Devanagari script. Do not write pure English.";
        break;
      default:
        detail = "English ONLY.";
        break;
    }

    return `[CRITICAL PRIORITY RULE — STRICT LANGUAGE & DIALECT MIRRORING]
- You MUST write your ENTIRE reply in ${detail}.
- STRICT PROHIBITION: NEVER respond in Hindi or Hinglish unless the user's message is explicitly written in Hindi/Hinglish.
- If the user writes in Manglish, you MUST reply in natural Manglish.
- If the user writes in Malayalam, you MUST reply in native Malayalam script.
- If the user writes in English, you MUST reply in natural English.
- Every reply MUST end with ONE meaningful, caring follow-up question to keep the conversation flowing naturally.
- Do not use English words in brackets. Do not provide translation.
- Keep your language matching 100% accurate.`;
  }

  /**
   * Helper to echo back normalized language name for debugs
   */
  public static mirrorLanguage(text: string): string {
    return this.detectLanguage(text);
  }

  /**
   * Multi-lingual offline mock fallback responses pool
   */
  public static offlineFallbackCompanion(text: string, lang: string, profile: any): string {
    const lower = text.toLowerCase();
    const cleanLang = this.normalizeLanguage(lang);

    const pool: Record<string, Record<string, string[]>> = {
      en: {
        greeting: ["Hey! It's so good to hear from you. What's on your mind today?", "Hello! How are you doing? I'm here to listen."],
        stress: ["I hear you. That sounds like a lot to carry right now. Remember to take it one step at a time.", "Let's take a deep breath together. You're doing your best."],
        success: ["Wow, that's amazing! I'm so proud of you! Let's celebrate this!", "That is wonderful news! You worked hard, and you deserve it."],
        default: ["Thank you for sharing that with me. Your feelings are completely valid.", "I'm here for you. How can I help you find some calm?"]
      },
      ml: {
        greeting: ["ഹലോ! സുഖമാണോ? നിന്നോട് സംസാരിക്കാൻ കഴിഞ്ഞതിൽ എനിക്ക് വളരെ സന്തോഷമുണ്ട്.", "ഹായ് കൂട്ടുകാരാ! ഇന്നത്തെ ദിവസം എങ്ങനെയുണ്ട്?"],
        stress: ["എനിക്ക് മനസ്സിലാകും. ഇത് വളരെ ബുദ്ധിമുട്ടേറിയ കാര്യമാണ്. പതുക്കെ ഓരോ കാര്യമായി ചെയ്യുക.", "നമുക്ക് പതുക്കെ ഒരുമിച്ച് ശ്വാസമെടുക്കാം. നീ നിന്റെ പരമാവധി ശ്രമിക്കുന്നുണ്ടല്ലോ."],
        success: ["വൗ, ഇത് വളരെ മികച്ചതാണ്! നിന്നെ ഓർത്ത് എനിക്ക് അഭിമാനമുണ്ട്!", "വളരെ സന്തോഷം നൽകുന്ന വാർത്തയാണിത്! നീ ഇത് അർഹിക്കുന്നു."],
        default: ["ഇത് എന്നോട് പങ്കുവെച്ചതിന് വളരെ നന്ദി. നിന്റെ വികാരങ്ങൾ പൂർണ്ണമായും ശരിയാണ്.", "ഞാൻ നിനക്കൊപ്പം ഇവിടെയുണ്ട്. വിഷമങ്ങൾ കുറയ്ക്കാൻ ഞാൻ എങ്ങനെയാണ് സഹായിക്കേണ്ടത്?"]
      },
      ta: {
        greeting: ["வணக்கம்! உங்களை சந்திப்பதில் மகிழ்ச்சி. இன்னைக்கு என்ன விசேஷம்?", "ஹாய் நண்பா! இன்னைக்கு நாள் எப்படி போகுது?"],
        stress: ["நான் கேட்கிறேன். இது மிகவும் கடினமானது தான். மெதுவாக ஒவ்வொன்றாக சமாளிப்போம்.", "ஆழமாக ஒரு முறை மூச்சை இழுத்து விடுங்கள். நீங்கள் உங்களால் முடிந்ததை செய்கிறீர்கள்."],
        success: ["வாவ், இது அருமை! உங்களை நினைத்து பெருமைப்படுகிறேன்!", "ரொம்ப நல்ல செய்தி! இதற்காக நீங்கள் கடுமையாக உழைத்தீர்கள்."],
        default: ["இதை என்னுடன் பகிர்ந்து கொண்டதற்கு நன்றி. உங்கள் உணர்வுகள் நியாயமானவை.", "நான் உங்களுக்காக இங்கே இருக்கிறேன். உங்கள் மனதை அமைதிப்படுத்த நான் என்ன செய்ய வேண்டும்?"]
      },
      hi: {
        greeting: ["नमस्ते! आपसे बात करके बहुत अच्छा लगा। आज क्या चल रहा है?", "नमस्ते! आप कैसे हैं? मैं यहाँ सुनने के लिए हूँ।"],
        stress: ["मैं आपकी बात समझ सकता हूँ। यह बहुत भारी लग रहा है। एक समय में एक ही कदम उठाएं।", "गहरी सांस लें। आप अपना सर्वश्रेष्ठ कर रहे हैं।"],
        success: ["वाह, यह बहुत बढ़िया है! मुझे आप पर गर्व है!", "यह बहुत अच्छी खबर है! आप इसके हकदार हैं।"],
        default: ["मेरे साथ यह साझा करने के लिए धन्यवाद। आपकी भावनाएं पूरी तरह से मान्य हैं।", "मैं यहाँ आपके लिए हूँ। मैं आपको शांत करने में कैसे मदद कर सकता हूँ?"]
      },
      ar: {
        greeting: ["أهلاً! يسعدني جداً سماع أخبارك. ما الذي يدور في ذهنك اليوم؟", "مرحباً! كيف حالك؟ أنا هنا لأستمع إليك."],
        stress: ["أنا أسمعك. يبدو هذا عبئاً ثقيلاً. تذكر أن تأخذ الأمر خطوة بخطوة.", "دعنا نأخذ نفساً عميقاً معاً. أنت تبذل قصارى جهدك."],
        success: ["رائع! أنا فخور بك جداً! دعنا نحتفل بهذا الإنجاز!", "هذه أخبار رائعة! أنت تستحق ذلك."],
        default: ["شكراً لمشاركة ذلك معي. مشاعرك صالحة تماماً.", "أنا هنا من أجلك. كيف يمكنني مساعدتك في العثور على بعض الهدوء؟"]
      },
      fr: {
        greeting: ["Salut! C'est un plaisir de te lire. Qu'as-tu en tête aujourd'hui?", "Bonjour! Comment vas-tu? Je suis là pour t'écouter."],
        stress: ["Je comprends. C'est lourd à porter. Prends les choses une étape à la fois.", "La pression peut être écrasante. Respire un grand coup. Tu fais de ton mieux."],
        success: ["Wow, c'est super! Je suis fier de toi! Célébrons cela!", "C'est une excellente nouvelle! Tu le mérites."],
        default: ["Merci de partager cela avec moi. Tes sentiments sont tout à fait valides.", "Je suis là pour toi. Comment puis-je t'aider à retrouver ton calme?"]
      },
      es: {
        greeting: ["¡Hola! Qué bueno saber de ti. ¿Qué tienes en mente hoy?", "¡Hola! ¿Cómo estás? Estoy aquí para escucharte."],
        stress: ["Te escucho. Eso parece mucho de llevar. Recuerda dar un paso a la vez.", "La presión puede ser abrumadora. Respira profundo. Estás dando lo mejor de ti."],
        success: ["¡Wow, eso es increíble! ¡Estoy muy orgulloso de ti! ¡Celebremos esto!", "¡Es una maravillosa noticia! Te lo mereces."],
        default: ["Gracias por compartir eso conmigo. Tus sentimientos son válidos.", "Estoy aquí para ti. ¿Cómo te puedo ayudar a encontrar calma?"]
      },
      de: {
        greeting: ["Hallo! Schön, von dir zu hören. Was beschäftigt dich heute?", "Hallo! Wie geht es dir? Ich bin hier, um zuzuhören."],
        stress: ["Ich verstehe dich. Das ist gerade viel zu tragen. Nimm dir eins nach dem anderen vor.", "Lass uns tief durchatmen. Du gibst dein Bestes."],
        success: ["Wow, das ist fantastisch! Ich bin so stolz auf dich!", "Das sind wundervolle Neuigkeiten! Du hast hart gearbeitet und es verdient."],
        default: ["Danke, dass du das mit mir teilst. Deine Gefühle sind absolut verständlich.", "Ich bin für dich da. Wie kann ich dir helfen, etwas Ruhe zu finden?"]
      },
      pt: {
        greeting: ["Olá! Que bom falar com você. O que está na sua mente hoje?", "Olá! Como você está? Estou aqui para ouvir."],
        stress: ["Eu te entendo. Isso parece muito pesado agora. Lembre-se de dar um passo de cada vez.", "Vamos respirar fundo juntos. Você está fazendo o seu melhor."],
        success: ["Uau, isso é incrível! Estou muito orgulhoso de você! Vamos comemorar!", "Essa é uma notícia maravilhosa! Você trabalhou duro e merece."],
        default: ["Obrigado por compartilhar isso comigo. Seus sentimentos são válidos.", "Estou aqui por você. Como posso te ajudar a encontrar calma?"]
      },
      it: {
        greeting: ["Ciao! Che bello sentirti. Cosa ti passa per la testa oggi?", "Ciao! Come stai? Sono qui per ascoltarti."],
        stress: ["Ti capisco. Sembra un peso grande da portare. Ricorda di fare un passo alla volta.", "Facciamo un respiro profondo insieme. Stai facendo del tuo meglio."],
        success: ["Wow, è fantastico! Sono così orgoglioso di te! Festeggiamo!", "Questa è una bellissima notizia! Hai lavorato sodo e te lo meriti."],
        default: ["Grazie per aver condiviso questo con me. I tuoi sentimenti sono validi.", "Sono qui per te. Come posso aiutarti a ritrovare la calma?"]
      },
      ja: {
        greeting: ["こんにちは！お話しできて嬉しいです。今日はどのようなことについて考えていますか？", "こんにちは！調子はいかがですか？お話を聞かせてください。"],
        stress: ["お気持ちはよく分かります。今は色々と大変な時期ですね。一歩ずつ進んでいきましょう。", "一緒に深呼吸をしましょう。あなたは本当によくやっています。"],
        success: ["わあ、素晴らしいですね！とても誇らしく思います。一緒にお祝いしましょう！", "素晴らしいニュースです！努力が実を結びましたね。本当におめでとうございます。"],
        default: ["お話ししてくれてありがとうございます。あなたの感情はとても大切なものです。", "私はここにいます。少しでも心が軽くなるようにお手伝いできることはありますか？"]
      },
      zh: {
        greeting: ["你好！很高兴收到你的消息。今天有什么想聊聊的吗？", "你好！最近怎么样？我很乐意倾听。"],
        stress: ["我能理解。这确实让人感到有些沉重。记得一步一步来。", "让我们一起深呼吸。你已经尽力了，做得很棒。"],
        success: ["哇，太棒了！我为你感到自豪！让我们庆祝一下！", "这真是个好消息！你付出了努力，这是你应得的。"],
        default: ["谢谢你和我分享这些。你的感受完全是合情合理的。", "我会一直支持你。我该怎么帮你想办法放松一下？"]
      },
      ko: {
        greeting: ["안녕하세요! 이야기 나누게 되어 정말 기뻐요. 오늘 어떤 생각이 드시나요?", "안녕하세요! 어떻게 지내고 계신가요? 이야기 들을 준비가 되어 있어요."],
        stress: ["이해해요. 지금 감당하기에 무척 무거운 짐이겠어요. 한 번에 하나씩 차근차근 해결해 봐요.", "함께 깊이 숨을 들이마셔 봐요. 당신은 최선을 다하고 있어요."],
        success: ["와, 정말 멋져요! 제가 다 자랑스럽네요! 오늘을 기념해 봐요!", "정말 기쁜 소식이네요! 열심히 노력한 대가이니 충분히 누릴 자격이 있어요."],
        default: ["저와 이야기를 나누어 주어 고마워요. 당신의 감정은 충분히 공감받을 가치가 있어요.", "언제든 곁에 있을게요. 마음이 한결 편안해지도록 어떻게 도와드릴까요?"]
      },
      ru: {
        greeting: ["Привет! Так рад тебя слышать. Что сегодня у тебя на уме?", "Привет! Как твои дела? Я здесь, чтобы выслушать."],
        stress: ["Я понимаю тебя. Это тяжелая ноша. Помни, что нужно двигаться шаг за шагом.", "Давай сделаем глубокий вдох вместе. Ты делаешь все, что в твоих силах."],
        success: ["Ого, это потрясающе! Я так горжусь тобой! Давай отпразднуем это!", "Это отличные новости! Ты много работал и заслужил это."],
        default: ["Спасибо, что поделился этим со мной. Твои чувства абсолютно понятны.", "Я здесь ради тебя. Как я могу помочь тебе обрести душевный покой?"]
      },
      tanglish: {
        greeting: ["Hello! Nalla irukiya? Iniki enna vishesham?", "Hi friend! Epadi iruku iniki day? Enna manasula iruku?"],
        stress: ["Naan solradha kekuren. Stress aagatha. One step at a time eduthuko.", "Romba pressure eduthukatha yaar. Deep breath edu. You are doing your best!"],
        success: ["Wow, super news! Enaku romba proud ah iruku! Nalla celebrate pannunga!", "Rombave happy ah iruku. You worked hard for this, and you deserve it."],
        default: ["Share pannathuku romba thanks. Un feelings ellam completely valid.", "Naan unaku supportive ah irupen. Solunga, epadi help panna mudiyum?"]
      },
      manglish: {
        greeting: ["Hello! Sugamano? Kure aayallo kandittu. Entha innu vishesham?", "Hi friend! Sugam thanneya? Entha mindil ullathu?"],
        stress: ["Njan kelkkunundu. Romba tension edukkatha. Relax aayi karyangal cheyyanam.", "Exam pressure okke natural aanu. Deep breath edukkuka. You are doing your best!"],
        success: ["Wow, ithu kidilam news aanallo! Enikku romba happy aayi! Celebrate cheyyu!", "Congratulation! Ithinayi nee kure kashtapettille, deserve cheyyunnundu."],
        default: ["Ithu share cheythathinu thanks. Un feelings ellam completely valid.", "Njan koodeyundu. Ippo mind free aakkan namukku enna cheyyendathu?"]
      },
      hinglish: {
        greeting: ["Hey! Kaise ho dost? Aaj kya chal raha hai mind mein?", "Hi! Milkar accha laga. Batao, kaise ho aaj?"],
        stress: ["Main samajh sakta hoon. Kafi heavy lag raha hoga. Ek baar mein ek hi cheez socho.", "Pressure ko lekar itna stress mat lo. Ek lambi saans lo, sab theek hoga."],
        success: ["Wow, maza aa gaya! Mujhe tum par proud hai! Chalo celebrate karte hain!", "Bahut badhiya news hai! Tumne iske liye hardwork kiya hai, deserve karte ho."],
        default: ["Mere sath share karne ke liye shukriya. Tumhare feelings bilkul valid hain.", "Main yahan tumhare liye hoon. Abhi tumhara mind fresh karne ke liye main kya karoon?"]
      }
    };

    const getCat = (): "greeting" | "stress" | "success" | "default" => {
      if (lower.includes("hello") || lower.includes("hey") || lower.includes("hi") || lower.includes("नमस्ते") || lower.includes("أهلاً") || lower.includes("வணக்கம்") || lower.includes("ഹലോ") || lower.includes("kaise") || lower.includes("sugam") || lower.includes("nalla")) return "greeting";
      if (lower.includes("stress") || lower.includes("anxi") || lower.includes("depress") || lower.includes("sad") || lower.includes("hurt") || lower.includes("tired") || lower.includes("pressure") || lower.includes("overwhelm") || lower.includes("मजबूर") || lower.includes("परेशान") || lower.includes("വിഷമം") || lower.includes("സങ്കടം") || lower.includes("பயம்") || lower.includes("கவலை")) return "stress";
      if (lower.includes("win") || lower.includes("happy") || lower.includes("success") || lower.includes("pass") || lower.includes("achieve") || lower.includes("proud") || lower.includes("खुश") || lower.includes("सफल") || lower.includes("വിජയം") || lower.includes("വെற்றி")) return "success";
      return "default";
    };

    const cat = getCat();
    const langPool = pool[cleanLang] || pool.en;
    const list = langPool[cat] || langPool.default;

    let baseResponse = list[Math.floor(Math.random() * list.length)];

    if (profile && profile.memories && profile.memories.length > 0 && Math.random() > 0.5) {
      const memory = profile.memories[Math.floor(Math.random() * profile.memories.length)];
      if (cleanLang === "en") {
        baseResponse += ` By the way, I remember you mentioned before about ${memory.content}. I hope that's going well too!`;
      } else if (cleanLang === "es") {
        baseResponse += ` Por cierto, ¡recuerdo que mencionaste algo sobre ${memory.content}! ¡Espero que vaya bien!`;
      } else if (cleanLang === "ml") {
        baseResponse += ` എങ്കിലും, നീ മുൻപ് ${memory.content} കുറിച്ച് പറഞ്ഞത് ഞാൻ ഓർക്കുന്നു. അതും നല്ല രീതിയിൽ പോകുന്നു എന്ന് കരുതുന്നു!`;
      } else if (cleanLang === "ta") {
        baseResponse += ` இருந்தாலும், நீங்கள் முன்பு ${memory.content} பற்றி குறிப்பிட்டதை நான் நினைவில் வைத்திருக்கிறேன். அதுவும் நன்றாக நடக்கும் என்று நம்புகிறேன்!`;
      } else if (cleanLang === "hi") {
        baseResponse += ` वैसे, मुझे याद है कि आपने पहले ${memory.content} के बारे में बात की थी। उम्मीद है कि वह भी अच्छा चल रहा होगा!`;
      } else if (cleanLang === "manglish") {
        baseResponse += ` Ennalum, nee munb ${memory.content} kurich paranjath njan orkkunundu. Athum nallapole pokunnu ennu karuthunnu!`;
      } else if (cleanLang === "tanglish") {
        baseResponse += ` Irunthalum, nee munadi ${memory.content} pathi sonnadhu enaku gnabagam iruku. Adhuvum nalla podhu nu namburen!`;
      } else if (cleanLang === "hinglish") {
        baseResponse += ` Waise, mujhe yaad hai aapne pehle ${memory.content} ke baare mein bataya tha. Umeed hai wo bhi sahi chal raha hoga!`;
      }
    }

    return baseResponse;
  }
}
