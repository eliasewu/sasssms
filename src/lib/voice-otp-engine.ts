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
export const MCC_LANGUAGE_DATABASE: Record<string, { country: string; language: string; fallback?: string }> = {
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
 * Strips leading + and takes first 3 digits.
 */
export function extractMcc(destination: string): string {
  const cleaned = destination.replace(/^\+/, "").replace(/[^0-9]/g, "");
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
  const entry = MCC_LANGUAGE_DATABASE[mcc];

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
 * [greeting] → [digit_0] → [digit_1] → ... → [digit_N]
 * 
 * If language is English, uses built-in audio (no DB lookup needed).
 * Otherwise, looks up each audio file from DB.
 */
export async function buildAudioPlaylist(
  audioFiles: AudioFile[],
  configId: number,
  language: string,
  otpCode: string
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

  // Add each digit of the OTP
  const digits = otpCode.split("");
  for (const digit of digits) {
    const digitAudio = audioFiles.find(
      (a) => a.configId === configId && a.language === language && a.digit === digit
    );
    playlist.push({
      order: order++,
      fileName: digitAudio?.fileName || `digit_${digit}_${language.toLowerCase()}.wav`,
      fileUrl: digitAudio?.fileUrl || `/audio/builtin/${language.toLowerCase()}/${digit}.wav`,
      language,
      digit,
      type: "digit",
    });
  }

  return playlist;
}

/**
 * Build playlists for all retry attempts.
 * 
 * Attempt 1: primary language (local)
 * Attempt 2: fallback/secondary language (if different from primary), otherwise repeat primary
 * Attempt 3: primary language again (final attempt)
 */
export async function buildAttemptPlaylists(
  audioFiles: AudioFile[],
  langResolution: LanguageResolution,
  otpCode: string,
  maxAttempts: number = 3
): Promise<AudioPlaylistItem[][]> {
  const configId = audioFiles[0]?.configId || 0;
  const playlists: AudioPlaylistItem[][] = [];

  const attemptLanguages = determineAttemptLanguages(langResolution, maxAttempts);

  for (let i = 0; i < maxAttempts; i++) {
    const language = attemptLanguages[i];
    const playlist = await buildAudioPlaylist(audioFiles, configId, language, otpCode);
    playlists.push(playlist);
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

// ── SIP Call Executor Interface ──
// In production, this would use Asterisk AMI (Asterisk Manager Interface) or SIP
// to originate calls. The interface is defined here so it can be swapped
// between a simulator and a real Asterisk connector.

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

/**
 * Simulated SIP call executor for testing/development.
 * In production, replace with real Asterisk AMI integration.
 */
export class SimulatedSipCallExecutor implements SipCallExecutor {
  private successRate: number;
  private minDuration: number;
  private maxDuration: number;

  constructor(successRate = 0.7, minDuration = 3, maxDuration = 25) {
    this.successRate = successRate;
    this.minDuration = minDuration;
    this.maxDuration = maxDuration;
  }

  async originateCall(params: {
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
  }> {
    const callSid = generateCallSid();
    
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 1500));

    const roll = Math.random();
    
    if (roll < this.successRate) {
      const duration = Math.floor(
        this.minDuration + Math.random() * (this.maxDuration - this.minDuration)
      );
      return {
        success: true,
        callSid,
        duration,
        status: "ANSWERED",
      };
    } else if (roll < this.successRate + 0.15) {
      return {
        success: false,
        callSid,
        duration: 0,
        status: "NO_ANSWER",
        errorMessage: "No answer after timeout",
      };
    } else if (roll < this.successRate + 0.25) {
      return {
        success: false,
        callSid,
        duration: 0,
        status: "BUSY",
        errorMessage: "Line busy",
      };
    } else {
      return {
        success: false,
        callSid,
        duration: 0,
        status: "FAILED",
        errorMessage: "SIP connection failed",
      };
    }
  }
}
