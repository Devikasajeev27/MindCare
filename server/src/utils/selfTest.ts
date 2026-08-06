import { LanguageEngine } from "./LanguageEngine.ts";

// Helper to generate combinations dynamically
function generateSentences(templates: string[], placeholderMaps: Record<string, string[]>): string[] {
  let list = [...templates];
  
  for (const placeholder of Object.keys(placeholderMaps)) {
    const values = placeholderMaps[placeholder];
    const newList: string[] = [];
    
    for (const t of list) {
      if (t.includes(placeholder)) {
        for (const val of values) {
          newList.push(t.replace(placeholder, val));
        }
      } else {
        newList.push(t);
      }
    }
    list = newList;
  }
  
  // Return unique, trimmed sentences, up to 100
  return Array.from(new Set(list.map(s => s.trim()))).slice(0, 100);
}

// 1. English Setup
const enTemplates = [
  "I am feeling {emotion} today.",
  "Today was a {descriptor} day.",
  "I need to {action} tomorrow morning.",
  "My {person} is very supportive of my goals.",
  "Can we discuss {topic} to help me relax?"
];
const enPlaceholders = {
  "{emotion}": ["tired", "anxious", "happy", "stressed", "sad", "joyful", "excited", "overwhelmed", "peaceful", "confused"],
  "{descriptor}": ["wonderful", "tough", "stressful", "beautiful", "long", "boring", "busy", "productive", "challenging", "great"],
  "{action}": ["study for exams", "prepare for the interview", "work on my career", "go to sleep early", "relax and listen to music", "talk to my doctor", "write in my journal", "exercise", "meditate", "clean my room"],
  "{person}": ["friend", "mother", "father", "sister", "brother", "therapist", "companion", "teacher", "partner", "boss"],
  "{topic}": ["hobbies", "favorite movies", "dreams for the future", "relationships", "childhood memories", "favorite foods", "travel plans", "music preferences", "career path", "anxiety triggers"]
};

// 2. Malayalam Setup (native script)
const mlTemplates = [
  "എനിക്ക് വളരെ {emotion} ഉണ്ട്.",
  "ഇന്ന് എനിക്ക് ഒരു {descriptor} ദിവസം ആയിരുന്നു.",
  "നാളെ എനിക്ക് {action} ചെയ്യേണ്ടതുണ്ട്.",
  "എന്റെ {person} എപ്പോഴും എന്നെ സഹായിക്കാറുണ്ട്.",
  "നമുക്ക് {topic} കുറിച്ച് സംസാരിക്കാം."
];
const mlPlaceholders = {
  "{emotion}": ["വിഷമം", "സങ്കടം", "സന്തോഷം", "ഭയം", "ക്ഷീണം", "ബുദ്ധിമുട്ട്", "ആശങ്ക", "സമാധാനം", "ദേഷ്യം", "വെല്ലുവിളി"],
  "{descriptor}": ["നല്ല", "ചീത്ത", "തിരക്കുള്ള", "ബുദ്ധിമുട്ടുള്ള", "മനോഹരമായ", "പ്രത്യാശയുള്ള", "സന്തോഷകരമായ", "ക്ഷീണിപ്പിക്കുന്ന", "വലിയ", "പ്രധാനപ്പെട്ട"],
  "{action}": ["പഠിക്കാൻ", "ജോലി", "വ്യായാമം", "ധ്യാനം", "യാത്ര", "വിശ്രമം", "പരീക്ഷ എഴുതാൻ", "ഭക്ഷണം പാകം", "പുസ്തകം വായിക്കാൻ", "കൂട്ടുകാരെ കാണാൻ"],
  "{person}": ["അമ്മ", "അച്ഛൻ", "സഹോദരൻ", "സഹോദരി", "സുഹൃത്ത്", "അധ്യാപകൻ", "ഡോക്ടർ", "ഭാര്യ", "ഭർത്താവ്", "കൂട്ടുകാരൻ"],
  "{topic}": ["പഠനത്തെ", "ജോലിയെ", "ആരോഗ്യത്തെ", "സ്വപ്നങ്ങളെ", "ഭക്ഷണത്തെ", "സിനിമകളെ", "യാത്രകളെ", "ഭാവിയെ", "കുടുംബത്തെ", "സന്തോഷങ്ങളെ"]
};

// 3. Manglish Setup (Malayalam in Roman/Latin script)
const manglishTemplates = [
  "Enikk inn {emotion} aanu.",
  "Njan {action} poyathaanu.",
  "Sugam alle {person}?",
  "Enth cheyyanam njan {topic} karyathil?",
  "Ithu nalla {descriptor} karyam aanu."
];
const manglishPlaceholders = {
  "{emotion}": ["stress", "tension", "happy", "sad", "tired", "anxiety", "sankadam", "vishamam", "pedi", "sugam"],
  "{action}": ["kazhikkan", "padikkan", "urangan", "nadakkan", "പഠിക്കാൻ", "work ചെയ്യാൻ", "cinema kaanan", "doctore kaanan", "kootukare kaanan", "yathra cheyyan"],
  "{person}": ["machane", "aliyo", "muthe", "bhai", "kootukara", "amma", "achane", "snehithane", "therapist", "companion"],
  "{topic}": ["careerinte", "studyinte", "future", "exams", "relationship", "healthinte", "sleepinte", "foodinte", "stressinte", "familyude"],
  "{descriptor}": ["polichu", "nalla", "kidilam", "kidu", "kashtappadu", "boring", "hectic", "heavy", "tough", "valiya"]
};

// 4. Tamil Setup (native script)
const taTemplates = [
  "எனக்கு இன்று மிகவும் {emotion} ஆக இருக்கிறது.",
  "இன்று எனக்கு ஒரு {descriptor} நாள்.",
  "நாளை நான் {action} செய்ய வேண்டும்.",
  "என் {person} எப்போதும் எனக்கு ஆதரவாக இருப்பார்.",
  "நாம் {topic} பற்றி பேசலாமா?"
];
const taPlaceholders = {
  "{emotion}": ["பயம்", "கவலை", "சந்தோஷம்", "மன அழுத்தம்", "சோர்வு", "கோபம்", "நிம்மதி", "துக்கம்", "வலி", "அமைதி"],
  "{descriptor}": ["நல்ல", "கடினமான", "மகிழ்ச்சியான", "சோர்வான", "அழகான", "பிஸியான", "முக்கியமான", "சாதாரண", "புதுவிதமான", "அற்புதமான"],
  "{action}": ["படிக்க", "தூங்க", "வேலை", "தியானம்", "சாப்பிட", "பயணம்", "தேர்வு எழுத", "உடற்பயிற்சி", "பாடல்கள் கேட்க", "நண்பர்களை சந்திக்க"],
  "{person}": ["அம்மா", "அப்பா", "தம்பி", "தங்கை", "நண்பன்", "ஆசிரியர்", "மருத்துவர்", "தோழி", "அண்ணன்", "அக்கா"],
  "{topic}": ["படிப்பு", "வேலை", "குடும்பம்", "கனவுகள்", "உணவு", "திரைப்படம்", "ஆரோக்கியம்", "பயணங்கள்", "மன அமைதி", "எதிர்காலம்"]
};

// 5. Tanglish Setup (Tamil in Roman/Latin script)
const tanglishTemplates = [
  "Enaku romba {emotion} ah iruku.",
  "Naan {action} pannitu iruken.",
  "Epadi iruka {person}?",
  "Saptiya illa {descriptor} sapad venuma?",
  "Yenaku {topic} pathi theriya venum."
];
const tanglishPlaceholders = {
  "{emotion}": ["tired", "stress", "tension", "happy", "sad", "bayama", "kavalaya", "anxious", "happy", "sugama"],
  "{action}": ["work", "study", "code", "sleep", "walk", "sapda", "padika", "paada", "odi", "game aada"],
  "{person}": ["nanba", "thala", "mame", "friend", "amma", "appa", "doctor", "therapist", "bro", "machan"],
  "{descriptor}": ["nalla", "super", "worst", "hectic", "tasty", "healthy", "simple", "sweet", "spicy", "heavy"],
  "{topic}": ["exam", "job", "career", "interview", "love", "sleep", "health", "life", "future", "relationship"]
};

// 6. Hindi Setup (native script)
const hiTemplates = [
  "मुझे आज बहुत {emotion} हो रहा है।",
  "आज का दिन काफी {descriptor} था।",
  "मुझे कल {action} करना है।",
  "मेरे {person} मेरी मदद करते हैं।",
  "क्या हम {topic} के बारे में बात कर सकते हैं?"
];
const hiPlaceholders = {
  "{emotion}": ["तनाव", "घबराहट", "खुशी", "चिंता", "दर्द", "संतुष्टि", "थकान", "डर", "गुस्सा", "दुख"],
  "{descriptor}": ["अच्छा", "थकाऊ", "तनावपूर्ण", "सुंदर", "व्यस्त", "उत्पादक", "मुश्किल", "मज़ेदार", "लंबा", "शांत"],
  "{action}": ["पढ़ाई", "काम", "आराम", "व्यायाम", "यात्रा", "डॉक्टर से मिलना", "तैयारी", "जर्नल लिखना", "सोना", "ध्यान"],
  "{person}": ["दोस्त", "माँ", "पिताजी", "भाई", "बहन", "शिक्षक", "डॉक्टर", "साथी", "सलाहकार", "मित्र"],
  "{topic}": ["करियर", "परीक्षा", "नींद", "रिश्तों", "भविष्य", "भोजन", "फिल्मों", "शौक", "मानसिक स्वास्थ्य", "लक्ष्यों"]
};

// 7. Hinglish Setup (Hindi in Roman/Latin script)
const hinglishTemplates = [
  "Mujhe aaj bahut {emotion} ho raha hai.",
  "Main bahut {descriptor} hu yaar.",
  "Kya karu {person}?",
  "Kal se {action} shuru karna hai.",
  "Hum {topic} ke baare mein baat karte hain."
];
const hinglishPlaceholders = {
  "{emotion}": ["stress", "tension", "anxiety", "headache", "gussa", "khushi", "darr", "durd", "thakan", "peace"],
  "{descriptor}": ["tired", "happy", "confused", "busy", "stressed", "sad", "excited", "sleepy", "upset", "bored"],
  "{person}": ["bhai", "yaar", "dost", "bro", "mummy", "papa", "doctor", "therapist", "sir", "didi"],
  "{action}": ["study", "work", "gym", "diet", "exams", "job preparation", "meditation", "sleeping early", "relaxation", "planning"],
  "{topic}": ["future", "career", "relationships", "exams", "sleep issues", "favorite food", "movies", "hobbies", "stress triggers", "goals"]
};

// 8. Arabic Setup (native script)
const arTemplates = [
  "أشعر بـ {emotion} اليوم.",
  "كان يومي {descriptor} جداً.",
  "يجب علي أن {action} غداً.",
  "عائلتي و {person} يدعمونني.",
  "دعنا نتحدث عن {topic}."
];
const arPlaceholders = {
  "{emotion}": ["التوتر", "القلق", "السعادة", "الحزن", "التعب", "الراحة", "الخوف", "الغضب", "الحماس", "النشاط"],
  "{descriptor}": ["جميلاً", "صعباً", "متعباً", "طويلاً", "رائعاً", "مزدحماً", "هادئاً", "مميزاً", "عادياً", "مثمراً"],
  "{action}": ["أدرس للامتحانات", "أنام مبكراً", "أذهب للعمل", "أرتاح قليلاً", "أمارس الرياضة", "أكتب مذكراتي", "أقابل صديقي", "أطبخ وجبة", "أقرا كتاباً", "أتأمل"],
  "{person}": ["صديقي", "طبيبي", "أخي", "أختي", "أمي", "أبي", "معلمي", "شريكي", "مستشاري", "زميلي"],
  "{topic}": ["المستقبل", "العمل", "الأهداف", "النوم", "الأكل المفضل", "الهوايات", "الأفلام المفضلة", "العلاقات", "الراحة النفسية", "الرحلات"]
};

// 9. Mixed Malayalam-English Setup
const mlEnTemplates = [
  "Enikk enikkarude {topic} parayan {emotion} aanu.",
  "Njan inn {action} busy aayirunnu.",
  "Nalla {descriptor} support enikk kitiyaal mathiyayirunnu.",
  "Ente {person} nalla aalaanu, support tharum.",
  "Let's write a {topic} review."
];
const mlEnPlaceholders = {
  "{topic}": ["project submission", "exam preparation", "office work", "workout schedule", "diet plan", "sleeping pattern", "career path", "interview details", "hobby details", "relationship issue"],
  "{emotion}": ["anxious", "excited", "anxiety", "depression", "happiness", "panic", "worry", "fear", "confidence", "stress"],
  "{action}": ["coding", "studying", "debugging", "planning", "sleeping", "relaxing", "exercising", "cooking", "traveling", "reading"],
  "{descriptor}": ["emotional", "professional", "friendly", "caring", "mental", "career", "study", "exam", "health", "sleep"],
  "{person}": ["manager", "colleague", "professor", "doctor", "therapist", "family member", "best friend", "roommate", "companion", "partner"]
};

// 10. Mixed Tamil-English Setup
const taEnTemplates = [
  "Yenaku iniki {topic} nalla check pannanum.",
  "Naan {action} panna romba {emotion} ah iruken.",
  "Ente {person} super ah support pannuranga.",
  "Irunthalum indha {topic} romba {descriptor} ah iruku.",
  "Epadi {action} pannanum solunga."
];
const taEnPlaceholders = {
  "{topic}": ["project deadline", "exam schedule", "interview results", "career goals", "sleep quality", "workout routine", "relationship problems", "diet control", "financial planning", "daily routine"],
  "{action}": ["prepare", "focus", "relax", "sleep", "code", "exercise", "study", "complete", "manage", "organize"],
  "{emotion}": ["tired", "stressed", "confused", "happy", "worried", "anxious", "scared", "excited", "peaceful", "neutral"],
  "{person}": ["teammate", "mentor", "professor", "therapist", "family", "friend", "cousin", "boss", "companion", "doctor"],
  "{descriptor}": ["hectic", "boring", "challenging", "stressful", "easy", "productive", "difficult", "smooth", "hectic", "confusing"]
};

// 11. Mixed Hindi-English Setup
const hiEnTemplates = [
  "Mujhe is {topic} ka bahut {emotion} ho raha hai.",
  "Main apna {topic} time par {action} karna chahta hu.",
  "Bhai, {action} karte waqt {emotion} feel hota hai.",
  "Mere {person} ne mujhe {descriptor} advice di hai.",
  "Hum is {topic} par {descriptor} discussion karenge."
];
const hiEnPlaceholders = {
  "{topic}": ["project delivery", "semester exam", "job interview", "future career", "sleep cycle", "gym routine", "relationship issue", "budget planning", "daily task", "course syllabus"],
  "{emotion}": ["stress", "anxiety", "excitement", "satisfaction", "panic", "fear", "tension", "worry", "peace", "frustration"],
  "{action}": ["complete", "manage", "handle", "finish", "balance", "improve", "prepare", "solve", "discuss", "plan"],
  "{person}": ["team lead", "class coordinator", "project guide", "family member", "close friend", "therapist", "counsellor", "companion", "roommate", "brother"],
  "{descriptor}": ["wonderful", "excellent", "practical", "stress-free", "healthy", "career-oriented", "positive", "detailed", "motivational", "simple"]
};

// Build corpus of 100 sentences per category
console.log("Generating 100 test cases per category programmatically...");

const testCorpus: Record<string, { expected: string; sentences: string[] }> = {
  en: { expected: "en", sentences: generateSentences(enTemplates, enPlaceholders) },
  ml: { expected: "ml", sentences: generateSentences(mlTemplates, mlPlaceholders) },
  manglish: { expected: "manglish", sentences: generateSentences(manglishTemplates, manglishPlaceholders) },
  ta: { expected: "ta", sentences: generateSentences(taTemplates, taPlaceholders) },
  tanglish: { expected: "tanglish", sentences: generateSentences(tanglishTemplates, tanglishPlaceholders) },
  hi: { expected: "hi", sentences: generateSentences(hiTemplates, hiPlaceholders) },
  hinglish: { expected: "hinglish", sentences: generateSentences(hinglishTemplates, hinglishPlaceholders) },
  ar: { expected: "ar", sentences: generateSentences(arTemplates, arPlaceholders) },
  manglish_mixed: { expected: "manglish", sentences: generateSentences(mlEnTemplates, mlEnPlaceholders) },
  tanglish_mixed: { expected: "tanglish", sentences: generateSentences(taEnTemplates, taEnPlaceholders) },
  hinglish_mixed: { expected: "hinglish", sentences: generateSentences(hiEnTemplates, hiEnPlaceholders) }
};

// Check sentence counts
let totalGenerated = 0;
for (const cat of Object.keys(testCorpus)) {
  const count = testCorpus[cat].sentences.length;
  totalGenerated += count;
  console.log(`- ${cat}: Generated ${count} test sentences.`);
}
console.log(`Total generated test cases: ${totalGenerated}\n`);

// Run self-test suite
console.log("====================================================");
console.log("          RUNNING LANGUAGE ENGINE SELF TEST         ");
console.log("====================================================");

const results: { category: string; expected: string; total: number; passed: number; failed: number; rate: string }[] = [];
let overallTotal = 0;
let overallPassed = 0;

for (const cat of Object.keys(testCorpus)) {
  const { expected, sentences } = testCorpus[cat];
  let passed = 0;
  let failed = 0;
  
  for (const sentence of sentences) {
    const detected = LanguageEngine.detectLanguage(sentence);
    const success = (detected === expected);
    
    // Also validate expected script/dialect rule against itself as a sanity check
    const isValid = LanguageEngine.validateResponseLanguage(sentence, expected);
    
    if (success && isValid) {
      passed++;
    } else {
      failed++;
      if (failed <= 3) {
        console.log(`[FAILED] Cat: ${cat} | Sentence: "${sentence}" | Detected: ${detected} | Validated: ${isValid}`);
      }
    }
  }
  
  overallTotal += sentences.length;
  overallPassed += passed;
  
  results.push({
    category: cat,
    expected,
    total: sentences.length,
    passed,
    failed,
    rate: `${((passed / sentences.length) * 100).toFixed(2)}%`
  });
}

console.log("\n====================================================");
console.log("                    TEST REPORT                     ");
console.log("====================================================");
console.table(results);

const overallRate = (overallPassed / overallTotal) * 100;
console.log(`\nOverall Success Rate: ${overallPassed}/${overallTotal} (${overallRate.toFixed(2)}%)`);
console.log("====================================================");

if (overallRate === 100) {
  console.log("PASS RATE: 100% - SUCCESS!");
  process.exit(0);
} else {
  console.error("FAIL: Success rate is not 100%!");
  process.exit(1);
}
