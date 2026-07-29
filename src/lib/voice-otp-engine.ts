/**
 * Voice OTP Engine
 * 
 * Orchestrates the full Voice OTP flow:
 * 1. Country prefix detection → MCC resolution → language mapping
 * 2. Audio playlist building (greeting + digits per language per attempt)
 * 3. Multi-attempt call execution via SIP/Asterisk with retry logic
 * 4. Status tracking and call log updates
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Comprehensive MCC → Country + Language Map (220+ entries) ──
// Re-exported from client-safe module so dashboard pages can import without server deps
export { MCC_LANGUAGE_DATABASE } from "@/lib/voice-otp-database";

// Keep the inline map for server-side consumers that need it bundled
const _MCC_LANGUAGE_DATABASE: Record<string, { country: string; language: string; fallback?: string }> = {
  // ── Asia ──
  "404": { country: "India", language: "Hindi", fallback: "English" },
  "405": { country: "India", language: "Hindi", fallback: "English" },
  "410": { country: "Pakistan", language: "Urdu", fallback: "English" },
  "413": { country: "Sri Lanka", language: "Sinhala", fallback: "English" },
  "414": { country: "Myanmar", language: "Burmese" },
  "415": { country: "Lebanon", language: "Arabic" },
  "416": { country: "Jordan", language: "Arabic" },
  "417": { country: "Syria", language: "Arabic" },
  "418": { country: "Iraq", language: "Arabic" },
  "419": { country: "Kuwait", language: "Arabic" },
  "420": { country: "Saudi Arabia", language: "Arabic" },
  "421": { country: "Yemen", language: "Arabic" },
  "422": { country: "Oman", language: "Arabic" },
  "424": { country: "UAE", language: "Arabic" },
  "425": { country: "Israel", language: "Hebrew", fallback: "English" },
  "426": { country: "Bahrain", language: "Arabic" },
  "427": { country: "Qatar", language: "Arabic" },
  "428": { country: "Mongolia", language: "Mongolian" },
  "429": { country: "Nepal", language: "Nepali", fallback: "English" },
  "430": { country: "UAE (Abu Dhabi)", language: "Arabic" },
  "431": { country: "UAE (Dubai)", language: "Arabic" },
  "432": { country: "Iran", language: "Persian" },
  "434": { country: "Uzbekistan", language: "Uzbek", fallback: "Russian" },
  "436": { country: "Tajikistan", language: "Tajik" },
  "437": { country: "Kyrgyzstan", language: "Kyrgyz", fallback: "Russian" },
  "438": { country: "Turkmenistan", language: "Turkmen" },
  "440": { country: "Japan", language: "Japanese" },
  "441": { country: "Japan", language: "Japanese" },
  "450": { country: "South Korea", language: "Korean" },
  "452": { country: "Vietnam", language: "Vietnamese" },
  "454": { country: "Hong Kong", language: "Cantonese", fallback: "English" },
  "455": { country: "Macau", language: "Cantonese", fallback: "Portuguese" },
  "456": { country: "Cambodia", language: "Khmer" },
  "457": { country: "Laos", language: "Lao" },
  "460": { country: "China", language: "Mandarin" },
  "461": { country: "China", language: "Mandarin" },
  "466": { country: "Taiwan", language: "Mandarin" },
  "467": { country: "North Korea", language: "Korean" },
  "470": { country: "Bangladesh", language: "Bangla", fallback: "English" },
  "472": { country: "Maldives", language: "Dhivehi", fallback: "English" },
  "480": { country: "Bhutan", language: "Dzongkha", fallback: "English" },
  "502": { country: "Malaysia", language: "Malay", fallback: "English" },
  "505": { country: "Australia", language: "English" },
  "510": { country: "Indonesia", language: "Indonesian" },
  "514": { country: "Timor-Leste", language: "Tetum", fallback: "Portuguese" },
  "515": { country: "Philippines", language: "Filipino", fallback: "English" },
  "520": { country: "Thailand", language: "Thai" },
  "525": { country: "Singapore", language: "English" },
  "528": { country: "Brunei", language: "Malay", fallback: "English" },
  "530": { country: "New Zealand", language: "English" },

  // ── Europe ──
  "200": { country: "Greece", language: "Greek" },
  "202": { country: "Greece", language: "Greek" },
  "204": { country: "Netherlands", language: "Dutch", fallback: "English" },
  "206": { country: "Belgium", language: "Dutch", fallback: "French" },
  "208": { country: "France", language: "French" },
  "212": { country: "Monaco", language: "French" },
  "213": { country: "Andorra", language: "Catalan", fallback: "Spanish" },
  "214": { country: "Spain", language: "Spanish" },
  "216": { country: "Hungary", language: "Hungarian" },
  "218": { country: "Bosnia", language: "Bosnian" },
  "219": { country: "Croatia", language: "Croatian" },
  "220": { country: "Serbia", language: "Serbian" },
  "221": { country: "Kosovo", language: "Albanian" },
  "222": { country: "Italy", language: "Italian" },
  "226": { country: "Romania", language: "Romanian" },
  "228": { country: "Switzerland", language: "German", fallback: "French" },
  "230": { country: "Czech Republic", language: "Czech" },
  "231": { country: "Slovakia", language: "Slovak" },
  "232": { country: "Austria", language: "German" },
  "234": { country: "UK", language: "English" },
  "235": { country: "UK", language: "English" },
  "238": { country: "Denmark", language: "Danish", fallback: "English" },
  "240": { country: "Sweden", language: "Swedish", fallback: "English" },
  "242": { country: "Norway", language: "Norwegian", fallback: "English" },
  "244": { country: "Finland", language: "Finnish", fallback: "English" },
  "246": { country: "Lithuania", language: "Lithuanian" },
  "247": { country: "Latvia", language: "Latvian" },
  "248": { country: "Estonia", language: "Estonian", fallback: "English" },
  "250": { country: "Russia", language: "Russian" },
  "255": { country: "Ukraine", language: "Ukrainian", fallback: "Russian" },
  "257": { country: "Belarus", language: "Belarusian", fallback: "Russian" },
  "259": { country: "Moldova", language: "Romanian", fallback: "Russian" },
  "260": { country: "Poland", language: "Polish" },
  "262": { country: "Germany", language: "German" },
  "266": { country: "Gibraltar", language: "English" },
  "268": { country: "Portugal", language: "Portuguese" },
  "270": { country: "Luxembourg", language: "French", fallback: "German" },
  "272": { country: "Ireland", language: "English" },
  "274": { country: "Iceland", language: "Icelandic", fallback: "English" },
  "276": { country: "Albania", language: "Albanian" },
  "278": { country: "Malta", language: "Maltese", fallback: "English" },
  "280": { country: "Cyprus", language: "Greek", fallback: "English" },
  "282": { country: "Georgia", language: "Georgian", fallback: "Russian" },
  "283": { country: "Armenia", language: "Armenian", fallback: "Russian" },
  "284": { country: "Bulgaria", language: "Bulgarian" },
  "286": { country: "Turkey", language: "Turkish" },
  "288": { country: "Faroe Islands", language: "Faroese", fallback: "Danish" },
  "290": { country: "Greenland", language: "Greenlandic", fallback: "Danish" },
  "293": { country: "Slovenia", language: "Slovenian" },
  "294": { country: "North Macedonia", language: "Macedonian" },
  "295": { country: "Liechtenstein", language: "German" },
  "297": { country: "Montenegro", language: "Montenegrin" },

  // ── Americas ──
  "300": { country: "Greece", language: "Greek" },
  "302": { country: "Canada", language: "English", fallback: "French" },
  "308": { country: "St. Pierre & Miquelon", language: "French" },
  "310": { country: "USA", language: "English" },
  "311": { country: "USA", language: "English" },
  "312": { country: "USA", language: "English" },
  "313": { country: "USA", language: "English" },
  "314": { country: "USA", language: "English" },
  "315": { country: "USA", language: "English" },
  "316": { country: "USA", language: "English" },
  "330": { country: "Puerto Rico", language: "Spanish", fallback: "English" },
  "332": { country: "US Virgin Islands", language: "English" },
  "334": { country: "Mexico", language: "Spanish" },
  "338": { country: "Jamaica", language: "English" },
  "340": { country: "Guadeloupe", language: "French" },
  "342": { country: "Barbados", language: "English" },
  "344": { country: "Antigua & Barbuda", language: "English" },
  "346": { country: "Cayman Islands", language: "English" },
  "348": { country: "British Virgin Islands", language: "English" },
  "350": { country: "Bermuda", language: "English" },
  "352": { country: "Grenada", language: "English" },
  "354": { country: "Montserrat", language: "English" },
  "356": { country: "St. Kitts & Nevis", language: "English" },
  "358": { country: "St. Lucia", language: "English" },
  "360": { country: "St. Vincent & Grenadines", language: "English" },
  "362": { country: "Netherlands Antilles", language: "Dutch", fallback: "English" },
  "363": { country: "Aruba", language: "Dutch", fallback: "English" },
  "364": { country: "Bahamas", language: "English" },
  "365": { country: "Anguilla", language: "English" },
  "366": { country: "Dominica", language: "English" },
  "368": { country: "Cuba", language: "Spanish" },
  "370": { country: "Dominican Republic", language: "Spanish" },
  "372": { country: "Haiti", language: "French", fallback: "Haitian Creole" },
  "374": { country: "Trinidad & Tobago", language: "English" },
  "376": { country: "Turks & Caicos", language: "English" },

  // ── South America ──
  "702": { country: "Belize", language: "English", fallback: "Spanish" },
  "704": { country: "Guatemala", language: "Spanish" },
  "706": { country: "El Salvador", language: "Spanish" },
  "708": { country: "Honduras", language: "Spanish" },
  "710": { country: "Nicaragua", language: "Spanish" },
  "712": { country: "Costa Rica", language: "Spanish" },
  "714": { country: "Panama", language: "Spanish" },
  "716": { country: "Peru", language: "Spanish" },
  "722": { country: "Argentina", language: "Spanish" },
  "724": { country: "Brazil", language: "Portuguese" },
  "730": { country: "Chile", language: "Spanish" },
  "732": { country: "Colombia", language: "Spanish" },
  "734": { country: "Venezuela", language: "Spanish" },
  "736": { country: "Bolivia", language: "Spanish" },
  "738": { country: "Guyana", language: "English" },
  "740": { country: "Ecuador", language: "Spanish" },
  "742": { country: "French Guiana", language: "French" },
  "744": { country: "Paraguay", language: "Spanish" },
  "746": { country: "Suriname", language: "Dutch" },
  "748": { country: "Uruguay", language: "Spanish" },

  // ── Africa ──
  "400": { country: "Azerbaijan", language: "Azerbaijani", fallback: "Russian" },
  "401": { country: "Kazakhstan", language: "Kazakh", fallback: "Russian" },
  "402": { country: "Bhutan", language: "Dzongkha" },
  "600": { country: "Morocco", language: "Arabic", fallback: "French" },
  "601": { country: "Morocco", language: "Arabic", fallback: "French" },
  "602": { country: "Egypt", language: "Arabic" },
  "603": { country: "Algeria", language: "Arabic", fallback: "French" },
  "604": { country: "Morocco", language: "Arabic", fallback: "French" },
  "605": { country: "Tunisia", language: "Arabic", fallback: "French" },
  "606": { country: "Libya", language: "Arabic" },
  "607": { country: "Gambia", language: "English" },
  "608": { country: "Senegal", language: "French" },
  "609": { country: "Mauritania", language: "Arabic", fallback: "French" },
  "610": { country: "Mali", language: "French" },
  "611": { country: "Guinea", language: "French" },
  "612": { country: "Ivory Coast", language: "French" },
  "613": { country: "Burkina Faso", language: "French" },
  "614": { country: "Niger", language: "French" },
  "615": { country: "Togo", language: "French" },
  "616": { country: "Benin", language: "French" },
  "617": { country: "Mauritius", language: "English", fallback: "French" },
  "618": { country: "Liberia", language: "English" },
  "619": { country: "Sierra Leone", language: "English" },
  "620": { country: "Ghana", language: "English" },
  "621": { country: "Nigeria", language: "English" },
  "622": { country: "Chad", language: "French", fallback: "Arabic" },
  "623": { country: "Central African Republic", language: "French" },
  "624": { country: "Cameroon", language: "French", fallback: "English" },
  "625": { country: "Cape Verde", language: "Portuguese" },
  "626": { country: "Sao Tome & Principe", language: "Portuguese" },
  "627": { country: "Equatorial Guinea", language: "Spanish", fallback: "French" },
  "628": { country: "Gabon", language: "French" },
  "629": { country: "Congo", language: "French" },
  "630": { country: "DR Congo", language: "French" },
  "631": { country: "Angola", language: "Portuguese" },
  "632": { country: "Guinea-Bissau", language: "Portuguese" },
  "633": { country: "Seychelles", language: "English", fallback: "French" },
  "634": { country: "Sudan", language: "Arabic" },
  "635": { country: "Rwanda", language: "Kinyarwanda", fallback: "English" },
  "636": { country: "Ethiopia", language: "Amharic", fallback: "English" },
  "637": { country: "Somalia", language: "Somali", fallback: "English" },
  "638": { country: "Djibouti", language: "French", fallback: "Arabic" },
  "639": { country: "Kenya", language: "Swahili", fallback: "English" },
  "640": { country: "Tanzania", language: "Swahili", fallback: "English" },
  "641": { country: "Uganda", language: "English" },
  "642": { country: "Burundi", language: "French" },
  "643": { country: "Mozambique", language: "Portuguese" },
  "645": { country: "Zambia", language: "English" },
  "646": { country: "Madagascar", language: "Malagasy", fallback: "French" },
  "647": { country: "Reunion", language: "French" },
  "648": { country: "Zimbabwe", language: "English" },
  "649": { country: "Namibia", language: "English" },
  "650": { country: "Malawi", language: "English" },
  "651": { country: "Lesotho", language: "English" },
  "652": { country: "Botswana", language: "English" },
  "653": { country: "Eswatini", language: "English" },
  "654": { country: "Comoros", language: "French", fallback: "Arabic" },
  "655": { country: "South Africa", language: "English" },
  "657": { country: "Eritrea", language: "Tigrinya", fallback: "English" },
  "658": { country: "St. Helena", language: "English" },
  "659": { country: "South Sudan", language: "English" },
};

// ── Country Dial Code → MCC Mapping ──
// When a destination starts with a country dialing code (e.g. +880 for Bangladesh),
// this map resolves it to the correct MCC (e.g. 470), since the first 3 digits of
// a phone number are the country code, not the MCC. Country codes can be 1-3 digits.
// Try longest match first (3 digits → 2 digits → 1 digit).
const COUNTRY_CODE_TO_MCC: Record<string, string> = {
  // 3-digit country codes
  "211": "659", "212": "604", "213": "603", "216": "605", "218": "606", "220": "607",
  "221": "608", "222": "609", "223": "610", "224": "611", "225": "612", "226": "613",
  "227": "614", "228": "615", "229": "616", "230": "617", "231": "618", "232": "619",
  "233": "620", "234": "621", "235": "622", "236": "623", "237": "624", "238": "625",
  "239": "626", "240": "627", "241": "628", "242": "629", "243": "630", "244": "631",
  "245": "632", "246": "633", "247": "633", "248": "633", "249": "634", "250": "635",
  "251": "636", "252": "637", "253": "638", "254": "639", "255": "640", "256": "641",
  "257": "642", "258": "643", "260": "645", "261": "646", "262": "647", "263": "648",
  "264": "649", "265": "650", "266": "651", "267": "652", "268": "653", "269": "654",
  "290": "658", "291": "657", "297": "363", "298": "288", "299": "290",
  "350": "266", "351": "268", "352": "270", "353": "272", "354": "274", "355": "276",
  "356": "278", "357": "280", "358": "244", "359": "284",
  "370": "246", "371": "247", "372": "248", "373": "259", "374": "283", "375": "257",
  "376": "213", "377": "212", "378": "222", "379": "222",
  "380": "255", "381": "220", "382": "297", "383": "221",
  "385": "219", "386": "293", "387": "218", "389": "294",
  "420": "230", "421": "231", "423": "295",
  "500": "750", "501": "702", "502": "704", "503": "706", "504": "708", "505": "710",
  "506": "712", "507": "714", "508": "308", "509": "372",
  "590": "340", "591": "736", "592": "738", "593": "740", "594": "742", "595": "744",
  "596": "340", "597": "746", "598": "748", "599": "362",
  "670": "514", "672": "505", "673": "528", "674": "536", "675": "537", "676": "539",
  "677": "540", "678": "541", "679": "542",
  "680": "545", "681": "546", "682": "548", "683": "555", "685": "549",
  "686": "545", "687": "546", "688": "553", "689": "547",
  "690": "554", "691": "550", "692": "551",
  "850": "467", "852": "454", "853": "455", "855": "456", "856": "457",
  "880": "470", "886": "466",
  "960": "472", "961": "415", "962": "416", "963": "417", "964": "418", "965": "419",
  "966": "420", "967": "421", "968": "422",
  "970": "425", "971": "424", "972": "425", "973": "426", "974": "427", "975": "402",
  "976": "428", "977": "429",
  "992": "436", "993": "438", "994": "400", "995": "282", "996": "437", "998": "434",
  // 2-digit country codes
  "20": "602", "27": "655",
  "30": "202", "31": "204", "32": "206", "33": "208", "34": "214",
  "36": "216", "39": "222",
  "40": "226", "41": "228", "43": "232", "44": "234", "45": "238",
  "46": "240", "47": "242", "48": "260", "49": "262",
  "51": "716", "52": "334", "53": "368", "54": "722", "55": "724",
  "56": "730", "57": "732", "58": "734",
  "60": "502", "61": "505", "62": "510", "63": "515", "64": "530",
  "65": "525", "66": "520",
  "81": "440", "82": "450", "84": "452", "86": "460",
  "90": "286", "91": "404", "92": "410", "93": "412", "94": "413",
  "95": "414", "98": "432",
  // 1-digit country codes (shared North American Numbering Plan → use USA 310 as default)
  "1": "310", "7": "250",
};

// ── Types ──
export interface VoiceOtpRequest {
  destination: string;
  otpCode: string;
  tenantSchemaName: string;
}

export interface LanguageResolution {
  mcc: string;
  country: string;
  primaryLanguage: string;
  fallbackLanguage: string;
  isEnglishPrimary: boolean;
}

export interface AudioFile {
  id: number;
  configId: number;
  language: string;
  digit: string;
  fileName: string | null;
  fileUrl: string | null;
  audioType: string;
}

export interface SipConfig {
  id: number;
  name: string;
  sipHost: string;
  sipPort: number;
  sipUsername: string;
  sipPassword: string;
  callerId: string;
  maxRetries: number;
  timeout: number;
  dialPrefix: string | null;
  callerIdMode: string;
  e164CountryPrefix: string | null;
  e164Format: string;
  isActive: boolean;
}

export interface AudioPlaylistItem {
  order: number;
  fileName: string;
  fileUrl: string;
  language: string;
  digit: string;
  type: "greeting" | "digit";
}

export interface CallAttempt {
  attempt: number;
  language: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  status: "IN_PROGRESS" | "ANSWERED" | "NO_ANSWER" | "BUSY" | "FAILED";
  audioPlaylist: AudioPlaylistItem[];
  sipCallId: string | null;
  errorMessage: string | null;
}

export interface VoiceOtpResult {
  success: boolean;
  destination: string;
  otpCode: string;
  language: string;
  attempts: CallAttempt[];
  finalStatus: "COMPLETED" | "FAILED" | "NO_ANSWER";
  totalDuration: number;
  sipConfigUsed: string | null;
}

// ── Core Functions ──

/**
 * Extract MCC (Mobile Country Code) from a phone number.
 * 
 * Strategy:
 * 1. Strip leading + and non-numeric chars
 * 2. Try longest-match country dial code → MCC mapping (3-digit first, then 2-digit, then 1-digit)
 * 3. If matched, return the real MCC (e.g. +880 → 470 for Bangladesh)
 * 4. Fall back to first 3 digits of the number (works when number already contains real MCC)
 */
export function extractMcc(destination: string): string {
  const cleaned = destination.replace(/^\+/, "").replace(/[^0-9]/g, "");

  // Try 3-digit country code match
  const prefix3 = cleaned.slice(0, 3);
  if (COUNTRY_CODE_TO_MCC[prefix3]) return COUNTRY_CODE_TO_MCC[prefix3];

  // Try 2-digit country code match
  const prefix2 = cleaned.slice(0, 2);
  if (COUNTRY_CODE_TO_MCC[prefix2]) return COUNTRY_CODE_TO_MCC[prefix2];

  // Try 1-digit country code match
  const prefix1 = cleaned.slice(0, 1);
  if (COUNTRY_CODE_TO_MCC[prefix1]) return COUNTRY_CODE_TO_MCC[prefix1];

  // Fallback: first 3 digits as-is (may be a real MCC already, or unknown)
  return cleaned.slice(0, 3);
}

/**
 * Resolve language from destination number.
 * 1. Extract MCC
 * 2. Look up in MCC_LANGUAGE_DATABASE
 * 3. Fall back to English if not found
 */
export function resolveLanguage(destination: string): LanguageResolution {
  const mcc = extractMcc(destination);
  const entry = _MCC_LANGUAGE_DATABASE[mcc];

  if (!entry) {
    return {
      mcc,
      country: "Unknown",
      primaryLanguage: "English",
      fallbackLanguage: "English",
      isEnglishPrimary: true,
    };
  }

  return {
    mcc,
    country: entry.country,
    primaryLanguage: entry.language,
    fallbackLanguage: entry.fallback || "English",
    isEnglishPrimary: entry.language === "English",
  };
}

/**
 * Build an audio playlist for a single call attempt.
 * 
 * Playlist structure:
 * [greeting] → [digit_0 × playCount] → [digit_1 × playCount] → ... → [digit_N × playCount]
 * 
 * If language is English, uses built-in audio (no DB lookup needed).
 * Otherwise, looks up each audio file from DB.
 */
export async function buildAudioPlaylist(
  audioFiles: AudioFile[],
  configId: number,
  language: string,
  otpCode: string,
  playCount: number = 3
): Promise<AudioPlaylistItem[]> {
  const playlist: AudioPlaylistItem[] = [];
  let order = 0;

  // Add greeting
  const greetingAudio = audioFiles.find(
    (a) => a.configId === configId && a.language === language && a.digit === "greeting"
  );
  playlist.push({
    order: order++,
    fileName: greetingAudio?.fileName || `greeting_${language.toLowerCase()}.wav`,
    fileUrl: greetingAudio?.fileUrl || `/audio/builtin/${language.toLowerCase()}/greeting.wav`,
    language,
    digit: "greeting",
    type: "greeting",
  });

  // Add each digit of the OTP, repeated playCount times
  const digits = otpCode.split("");
  for (const digit of digits) {
    const digitAudio = audioFiles.find(
      (a) => a.configId === configId && a.language === language && a.digit === digit
    );
    for (let rep = 0; rep < playCount; rep++) {
      playlist.push({
        order: order++,
        fileName: digitAudio?.fileName || `digit_${digit}_${language.toLowerCase()}.wav`,
        fileUrl: digitAudio?.fileUrl || `/audio/builtin/${language.toLowerCase()}/${digit}.wav`,
        language,
        digit,
        type: "digit",
      });
    }
  }

  return playlist;
}

/**
 * Build a BILINGUAL audio playlist — concatenates first language + second language
 * into a single call stream. Used when voice_otp_config.bilingual = true.
 *
 * Playlist:
 *   [greeting_lang1] → [digit_lang1 × playCount] → [greeting_lang2] → [digit_lang2 × playCount]
 */
export async function buildBilingualPlaylist(
  audioFiles: AudioFile[],
  configId: number,
  primaryLanguage: string,
  secondaryLanguage: string,
  otpCode: string,
  playCount: number = 3
): Promise<AudioPlaylistItem[]> {
  const playlist1 = await buildAudioPlaylist(audioFiles, configId, primaryLanguage, otpCode, playCount);
  const playlist2 = await buildAudioPlaylist(audioFiles, configId, secondaryLanguage, otpCode, playCount);

  // Re-number order for sequential playback
  const merged = [...playlist1, ...playlist2];
  return merged.map((item, i) => ({ ...item, order: i }));
}

/**
 * Build playlists for all retry attempts.
 * 
 * When bilingual=true: single call with concatenated 1st + 2nd language audio.
 * When bilingual=false: multiple call attempts alternating languages.
 * 
 * @param voiceOtpConfig - voice_otp_config row with bilingual, play_count, retry_count, etc.
 */
export async function buildAttemptPlaylists(
  audioFiles: AudioFile[],
  langResolution: LanguageResolution,
  otpCode: string,
  voiceOtpConfig?: { primaryLanguage?: string; secondaryLanguage?: string; bilingual?: boolean; playCount?: number; retryCount?: number }
): Promise<AudioPlaylistItem[][]> {
  const configId = audioFiles[0]?.configId || 0;
  const playCount = voiceOtpConfig?.playCount || 3;
  const retryCount = voiceOtpConfig?.retryCount || 1;
  const bilingual = voiceOtpConfig?.bilingual || false;
  const secondaryLang = voiceOtpConfig?.secondaryLanguage || langResolution.fallbackLanguage;
  const maxAttempts = bilingual ? 1 : Math.max(1, retryCount);

  const playlists: AudioPlaylistItem[][] = [];

  if (bilingual) {
    // Single call with bilingual audio concatenation
    const playlist = await buildBilingualPlaylist(
      audioFiles, configId,
      voiceOtpConfig?.primaryLanguage || langResolution.primaryLanguage,
      secondaryLang,
      otpCode, playCount
    );
    playlists.push(playlist);
  } else {
    // Multi-attempt with alternating languages
    const attemptLanguages = determineAttemptLanguages(langResolution, maxAttempts);
    for (let i = 0; i < maxAttempts; i++) {
      const language = attemptLanguages[i];
      const playlist = await buildAudioPlaylist(audioFiles, configId, language, otpCode, playCount);
      playlists.push(playlist);
    }
  }

  return playlists;
}

/**
 * Determine which language to use for each attempt.
 * 
 * Scenario A (Mixed, local ≠ English):
 *   Attempt 1: local language
 *   Attempt 2: English (fallback)
 *   Attempt 3: local language
 * 
 * Scenario B (English primary):
 *   All attempts: English
 * 
 * Scenario C (Repeated local, same as primary):
 *   All attempts: local language
 */
export function determineAttemptLanguages(
  langResolution: LanguageResolution,
  maxAttempts: number = 3
): string[] {
  const { primaryLanguage, fallbackLanguage, isEnglishPrimary } = langResolution;
  
  if (isEnglishPrimary) {
    // All attempts in English
    return Array(maxAttempts).fill("English");
  }

  if (primaryLanguage === fallbackLanguage) {
    // Same language for all attempts
    return Array(maxAttempts).fill(primaryLanguage);
  }

  // Mixed: alternate between local and fallback
  // Attempt 1: primary (local), Attempt 2: fallback, Attempt 3: primary
  const languages: string[] = [];
  for (let i = 0; i < maxAttempts; i++) {
    if (i === 1 && fallbackLanguage !== primaryLanguage) {
      languages.push(fallbackLanguage);
    } else {
      languages.push(primaryLanguage);
    }
  }
  return languages;
}

/**
 * Generate a unique call SID (Session ID).
 */
export function generateCallSid(): string {
  const ts = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `VOTCALL_${ts}_${random}`;
}

// ── SIP Call Executor Interface (implemented by AsteriskAmiExecutor) ──

export interface SipCallExecutor {
  originateCall(params: {
    destination: string;
    callerId: string;
    sipHost: string;
    sipPort: number;
    sipUsername: string;
    sipPassword: string;
    timeout: number;
    audioPlaylist: AudioPlaylistItem[];
  }): Promise<{
    success: boolean;
    callSid: string;
    duration: number;
    status: "ANSWERED" | "NO_ANSWER" | "BUSY" | "FAILED";
    errorMessage?: string;
  }>;
}

// ── Shared Voice OTP Delivery (called by both HTTP API and SMPP server) ──

import { tenantQuery } from "@/lib/tenant-schema";
import { AsteriskAmiExecutor } from "@/lib/asterisk-ami";

/** Result of executing a Voice OTP call */
export interface VoiceOtpCallResult {
  success: boolean;
  callSid: string;
  language: string;
  langResolution: LanguageResolution;
  callAttempts: CallAttempt[];
  totalDuration: number;
  sipConfigName: string | null;
  errorMessage?: string;
}

/** Shared AMI executor instance */
let _sharedAmiExecutor: AsteriskAmiExecutor | null = null;
function getAmiExecutor(): AsteriskAmiExecutor {
  if (!_sharedAmiExecutor) _sharedAmiExecutor = new AsteriskAmiExecutor();
  return _sharedAmiExecutor;
}

/**
 * Execute a full Voice OTP call with retry logic.
 * Called by both the HTTP API (send-sms/route.ts) and the SMPP server (smpp-server.ts).
 *
 * Handles: language detection, concurrent call throttling, audio playlist building,
 * SIP call execution (external API or Asterisk AMI), call log insert/update.
 */
export async function executeVoiceOtpCall(params: {
  schemaName: string;
  tenantId: number;
  destination: string;
  sender: string;
  otpCode: string;
  messageId: string;
  supplierId: number | null;
  maxConcurrentCalls: number;
}): Promise<VoiceOtpCallResult> {
  const { schemaName, tenantId, destination, sender, otpCode, messageId, supplierId, maxConcurrentCalls } = params;
  const amiExecutor = getAmiExecutor();

  // ── 1. Country & Language Detection ──
  const langResolution = resolveLanguage(destination);
  const language = langResolution.primaryLanguage;
  const mcc = langResolution.mcc;

  // ── 2. Check concurrent call limit ──
  const maxConcurrent = maxConcurrentCalls ?? 10;
  const activeCalls = await tenantQuery(
    schemaName,
    "SELECT COUNT(*) as count FROM voice_otp_call_logs WHERE status = 'IN_PROGRESS'"
  );
  const activeCount = parseInt(activeCalls.rows[0]?.count || "0");
  if (activeCount >= maxConcurrent) {
    return {
      success: false,
      callSid: "", language, langResolution,
      callAttempts: [], totalDuration: 0, sipConfigName: null,
      errorMessage: `Concurrent call limit reached (max ${maxConcurrent}). Try again shortly.`,
    };
  }

  // ── 2b. Per-destination guard: prevent overlapping calls to the same number ──
  // If a call is already IN_PROGRESS for this destination (including during retry delays),
  // reject the new request to avoid double-calling the user.
  const existingCall = await tenantQuery(
    schemaName,
    `SELECT id, call_sid, created_at FROM voice_otp_call_logs
     WHERE destination = $1 AND status = 'IN_PROGRESS'
     ORDER BY created_at DESC LIMIT 1`,
    [destination]
  );
  if (existingCall.rows.length > 0) {
    const existing = existingCall.rows[0];
    const ageSeconds = (Date.now() - new Date(existing.created_at as string).getTime()) / 1000;
    // If the existing in-progress call is older than 5 minutes, it's likely stale
    // (process crashed). Mark it FAILED and allow the new call through.
    if (ageSeconds > 300) {
      console.log(`[VOICE-OTP] Cleaning up stale IN_PROGRESS call for ${destination} (age=${ageSeconds.toFixed(0)}s)`);
      tenantQuery(
        schemaName,
        "UPDATE voice_otp_call_logs SET status = 'FAILED' WHERE id = $1",
        [existing.id]
      ).catch(() => {});
      // Fall through — allow the new call
    } else {
      return {
        success: false,
        callSid: "", language, langResolution,
        callAttempts: [], totalDuration: 0, sipConfigName: null,
        errorMessage: `A call is already in progress for ${destination}. Please wait for it to complete before retrying.`,
      };
    }
  }

  // ── 3. Fetch audio files, SIP configs & voice OTP language config ──
  const [audioResult, sipResult, votpConfigResult] = await Promise.all([
    tenantQuery(schemaName, "SELECT * FROM voice_otp_audio ORDER BY id").catch(() => ({ rows: [] as AudioFile[] })),
    tenantQuery(schemaName, "SELECT * FROM voice_otp_sip_config WHERE is_active = true ORDER BY id").catch(() => ({ rows: [] as SipConfig[] })),
    tenantQuery(schemaName,
      `SELECT * FROM voice_otp_config
       WHERE is_active = true AND EXISTS (
         SELECT 1 FROM unnest(string_to_array(COALESCE(prefixes,''), ',')) AS pfx
         WHERE $1 LIKE pfx || '%'
       ) ORDER BY id LIMIT 1`,
      ['+' + destination.replace(/^\+/, '')]
    ).catch(() => ({ rows: [] as Record<string,unknown>[] })),
  ]);
  const audioFiles: AudioFile[] = audioResult.rows;
  const sipConfigs: SipConfig[] = sipResult.rows;
  const activeSip = sipConfigs[0] || null;

  // ── Get retry/play config from voice_otp_config ──
  const votpConfig = votpConfigResult.rows[0] as Record<string,unknown> | undefined;
  const retryCount = (votpConfig?.retry_count as number) || (activeSip?.maxRetries as number) || 3;
  const playCount = (votpConfig?.play_count as number) || 3;
  const bilingual = (votpConfig?.bilingual as boolean) || false;
  const languageMode = (votpConfig?.language_mode as string) || 'local';
  const primaryLang = (votpConfig?.primary_language as string) || langResolution.primaryLanguage;
  const secondaryLang = (votpConfig?.secondary_language as string) || langResolution.fallbackLanguage;

  // ── 4. Build audio playlists for all attempts ──
  // language_mode: 'local' → local + English fallback, 'dual' → bilingual single call, 'international' → English only
  const effectiveBilingual = languageMode === 'dual' ? true : bilingual;
  const effectiveRetryCount = languageMode === 'international' ? 1 : (languageMode === 'dual' ? 1 : retryCount);
  const effectivePrimaryLang = languageMode === 'international' ? 'English' : primaryLang;
  const effectiveSecondaryLang = languageMode === 'international' ? 'English' : secondaryLang;

  const attemptLanguages = languageMode === 'international'
    ? ['English']
    : determineAttemptLanguages(langResolution, effectiveRetryCount);
  let attemptPlaylists: Array<Array<AudioPlaylistItem>> = [];
  try {
    attemptPlaylists = await buildAttemptPlaylists(audioFiles, langResolution, otpCode, {
      primaryLanguage: effectivePrimaryLang,
      secondaryLanguage: effectiveSecondaryLang,
      bilingual: effectiveBilingual,
      playCount,
      retryCount: effectiveRetryCount,
    });
  } catch {
    attemptPlaylists = attemptLanguages.map(() => []);
  }

  // Apply dial_prefix from SIP config (e.g. "99900" → "99900+8801712345678")
  const dialPrefix = activeSip?.dialPrefix || null;
  const dialDestination = dialPrefix ? dialPrefix + destination.replace(/^\+/, '') : destination;

  // Generate E.164 caller ID if mode is 'e164' — random number with selected country prefix
  const callerIdMode = activeSip?.callerIdMode || 'otp';
  const e164CountryPrefix = activeSip?.e164CountryPrefix || '';
  const e164Format = activeSip?.e164Format || 'plus';
  let effectiveCallerId: string;
  if (callerIdMode === 'e164' && e164CountryPrefix) {
    // Generate random 8-10 digit local number
    const localLen = 7 + Math.floor(Math.random() * 4); // 7-10 digits
    let localNum = '';
    for (let i = 0; i < localLen; i++) localNum += Math.floor(Math.random() * 10).toString();
    // Ensure first digit isn't 0 for realistic local numbers
    if (localNum[0] === '0') localNum = (Math.floor(Math.random() * 9) + 1).toString() + localNum.slice(1);
    const countryNum = e164CountryPrefix.replace(/^\+/, '');
    if (e164Format === 'none') {
      effectiveCallerId = countryNum + localNum;
    } else if (e164Format === 'doubleZero') {
      effectiveCallerId = '00' + countryNum + localNum;
    } else {
      effectiveCallerId = '+' + countryNum + localNum;
    }
  } else {
    effectiveCallerId = activeSip?.callerId || 'Net2APP';
  }

  // ── 5. Call execution via Asterisk AMI ──
  // Retry delays: 0s (first call), 35s (retry 2), 70s (retry 3) — ~30-35s per spec
  const reconnectSchedule = [0, 35, 70];
  const callAttempts: CallAttempt[] = [];
  let totalDuration = 0;
  let callSuccess = false;
  const callSid = generateCallSid();

  // Log initial IN_PROGRESS
  await tenantQuery(
    schemaName,
    `INSERT INTO voice_otp_call_logs (destination, otp_code, language, status, attempt_count,
      sip_config_id, sip_config_name, call_sid, country, mcc)
     VALUES ($1, $2, $3, 'IN_PROGRESS', 0, $4, $5, $6, $7, $8)`,
    [destination, otpCode, language, activeSip?.id || null,
     activeSip?.name || null, callSid, langResolution.country, mcc]
  );

  for (let attempt = 1; attempt <= effectiveRetryCount; attempt++) {
    const attLanguage = attemptLanguages[attempt - 1];
    const attPlaylist = attemptPlaylists[attempt - 1] || [];
    const startTime = new Date().toISOString();

    if (attempt > 1) {
      const delaySec = reconnectSchedule[Math.min(attempt - 1, reconnectSchedule.length - 1)];
      if (delaySec > 0) {
        console.log(`[VOICE-OTP] Retry attempt ${attempt}/${retryCount} — waiting ${delaySec}s before next call...`);
        await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
      }
    }

    let sipResult: { success: boolean; callSid: string; duration: number; status: "ANSWERED"|"NO_ANSWER"|"BUSY"|"FAILED"; errorMessage?: string };

    // Asterisk AMI call execution (SIP config required)
    if (activeSip) {
      try {
        sipResult = await amiExecutor.originateCall({
          destination: dialDestination,
          callerId: effectiveCallerId,
          sipHost: activeSip.sipHost || "", sipPort: activeSip.sipPort || 5060,
          sipUsername: activeSip.sipUsername || "", sipPassword: activeSip.sipPassword || "",
          timeout: activeSip.timeout || 30,
          audioPlaylist: attPlaylist,
        });
      } catch (err) {
        sipResult = {
          success: false, callSid: generateCallSid(), duration: 0, status: "FAILED",
          errorMessage: `Asterisk AMI error: ${(err as Error).message}`,
        };
      }
    } else {
      sipResult = {
        success: false, callSid: generateCallSid(), duration: 0, status: "FAILED",
        errorMessage: "No SIP config configured — configure voice_otp_sip_config or use Asterisk AMI",
      };
    }

    const endTime = new Date().toISOString();
    const attRecord: CallAttempt = {
      attempt, language: attLanguage, startTime, endTime,
      duration: sipResult.duration, status: sipResult.status,
      audioPlaylist: attPlaylist, sipCallId: sipResult.callSid,
      errorMessage: sipResult.errorMessage || null,
    };
    callAttempts.push(attRecord);
    totalDuration += sipResult.duration || 0;

    if (sipResult.success) {
      callSuccess = true;
      break;
    }
  }

  // ── 6. Final status update ──
  const finalStatus = callSuccess ? "COMPLETED" : "FAILED";
  const finalPlaylist = callAttempts[callAttempts.length - 1]?.audioPlaylist || [];

  await tenantQuery(
    schemaName,
    `UPDATE voice_otp_call_logs SET status = $1, duration = $2, attempt_count = $3,
      attempt_log = $4, audio_playlist = $5
     WHERE call_sid = $6`,
    [finalStatus, totalDuration, callAttempts.length,
     JSON.stringify(callAttempts),
     JSON.stringify(finalPlaylist),
     callSid]
  );

  return {
    success: callSuccess,
    callSid, language, langResolution,
    callAttempts, totalDuration,
    sipConfigName: activeSip?.name || null,
    errorMessage: callSuccess ? undefined : `Call failed after ${callAttempts.length} attempt(s)`,
  };
}


