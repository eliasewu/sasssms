#!/usr/bin/env python3
"""
gen-voice-otp-high-quality.py — generate HIGH-QUALITY builtin Voice OTP audio
(greeting + digits 0-9) for ALL 56 supported languages using Microsoft Edge TTS
(neural voices, free, no API key).

Why: the previous builtin set used Google Translate TTS (64 kbps, robotic) for
15 languages only. This script produces natural-sounding neural-voice MP3s,
then converts them to WAV (24 kHz mono — the engine's builtin-audio fallback
URLs reference `.wav`, and Asterisk plays WAV natively).

Usage:  python3 scripts/gen-voice-otp-high-quality.py   (from repo root)
        # requires: pip install edge-tts   and   ffmpeg on PATH
Output: public/audio/builtin/<lang>/greeting.wav, 0.wav ... 9.wav

Language → voice mapping notes:
  * Female neural voice picked per language (best intelligibility on phone).
  * Armenian has no Edge TTS voice → uses Russian voice (documented fallback).
  * Digits are spelled in each language's native script where TTS quality
    requires it (Arabic, Persian, Thai, Khmer, Myanmar, Indic scripts, etc.)
    so the neural voice reads them exactly like a phone number.
"""

import asyncio
import os
import shutil
import subprocess
import sys
import tempfile

import edge_tts

OUT_DIR = "public/audio/builtin"
RATE = "-12%"   # slightly slower — clearer digits over the phone
PITCH = "+2Hz"  # slight lift — cuts through phone audio better

# Western digits — used for most languages
WEST = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
# Arabic-Indic digits (Arabic, Persian, Urdu use these natively)
ARAB = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]
# Devanagari (Hindi, Nepali)
DEVA = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"]
# Bengali-Assamese
BENG = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]
# Gurmukhi (Punjabi — not used, kept for reference)
# Gujarati
GUJA = ["૦", "૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯"]
# Tamil
TAML = ["௦", "௧", "௨", "௩", "௪", "௫", "௬", "௭", "௮", "௯"]
# Thai
THAI = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"]
# Khmer
KHMR = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"]
# Myanmar (Burmese)
MYAN = ["၀", "၁", "၂", "၃", "၄", "၅", "၆", "၇", "၈", "၉"]
# Georgian
GEOR = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
# Simplified Chinese (Mandarin — 二 reads "èr")
MAND = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
# Cantonese — literary readings (二 ji6, 零 ling4) — correct for phone digits
CANT = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]

# folder | (voice, greeting, digits)
LANGS = {
    "english":     ("en-US-AriaNeural", "Your OTP code is", WEST),
    "spanish":     ("es-ES-ElviraNeural", "Su código de verificación es", WEST),
    "arabic":      ("ar-EG-SalmaNeural", "رمز التحقق الخاص بك هو", ARAB),
    "french":      ("fr-FR-DeniseNeural", "Votre code de vérification est", WEST),
    "portuguese":  ("pt-BR-FranciscaNeural", "Seu código de verificação é", WEST),
    "russian":     ("ru-RU-SvetlanaNeural", "Ваш код подтверждения", WEST),
    "german":      ("de-DE-KatjaNeural", "Ihr Bestätigungscode ist", WEST),
    "italian":     ("it-IT-ElsaNeural", "Il tuo codice di verifica è", WEST),
    "dutch":       ("nl-NL-ColetteNeural", "Uw verificatiecode is", WEST),
    "turkish":     ("tr-TR-EmelNeural", "Doğrulama kodunuz", WEST),
    "hindi":       ("hi-IN-SwaraNeural", "आपका ओटीपी कोड है", DEVA),
    "bangla":      ("bn-IN-TanishaaNeural", "আপনার ওটিপি কোড হলো", BENG),
    "urdu":        ("ur-PK-UzmaNeural", "آپ کا تصدیقی کوڈ ہے", WEST),  # Western digits — Arabic-Indic digits get dropped by Edge TTS
    "indonesian":  ("id-ID-GadisNeural", "Kode OTP Anda adalah", WEST),
    "malay":       ("ms-MY-YasminNeural", "Kod OTP anda ialah", WEST),
    "filipino":    ("fil-PH-BlessicaNeural", "Ang iyong OTP code ay", WEST),
    "thai":        ("th-TH-PremwadeeNeural", "รหัสยืนยันของคุณคือ", WEST),  # Western digits — Thai script digits get dropped by Edge TTS
    "vietnamese":  ("vi-VN-HoaiMyNeural", "Mã OTP của bạn là", WEST),
    "mandarin":    ("zh-CN-XiaoxiaoNeural", "您的验证码是", MAND),
    "japanese":    ("ja-JP-NanamiNeural", "あなたの確認コードは", WEST),
    "korean":      ("ko-KR-SunHiNeural", "귀하의 인증 코드는", WEST),
    "cantonese":   ("zh-HK-HiuMaanNeural", "你嘅驗證碼係", CANT),
    "swahili":     ("sw-TZ-RehemaNeural", "Nambari yako ya OTP ni", WEST),
    "polish":      ("pl-PL-ZofiaNeural", "Twój kod weryfikacyjny to", WEST),
    "swedish":     ("sv-SE-SofieNeural", "Din verifieringskod är", WEST),
    "norwegian":   ("nb-NO-PernilleNeural", "Din bekreftelseskode er", WEST),
    "danish":      ("da-DK-ChristelNeural", "Din bekræftelseskode er", WEST),
    "finnish":     ("fi-FI-NooraNeural", "Vahvistuskoodisi on", WEST),
    "ukrainian":   ("uk-UA-PolinaNeural", "Ваш код підтвердження", WEST),
    "romanian":    ("ro-RO-AlinaNeural", "Codul tău de verificare este", WEST),
    "czech":       ("cs-CZ-VlastaNeural", "Váš ověřovací kód je", WEST),
    "hungarian":   ("hu-HU-NoemiNeural", "Az Ön ellenőrző kódja", WEST),
    "greek":       ("el-GR-AthinaNeural", "Ο κωδικός επαλήθευσής σας είναι", WEST),
    "hebrew":      ("he-IL-HilaNeural", "קוד האימות שלך הוא", WEST),
    "persian":     ("fa-IR-DilaraNeural", "کد تأیید شما", ARAB),
    "somali":      ("so-SO-UbaxNeural", "Koodhkaaga OTP waa", WEST),
    "amharic":     ("am-ET-MekdesNeural", "የእርስዎ OTP ኮድ", WEST),
    "burmese":     ("my-MM-NilarNeural", "သင့် OTP ကုဒ်မှာ", MYAN),
    "khmer":       ("km-KH-SreymomNeural", "លេខកូដ OTP របស់អ្នកគឺ", KHMR),
    "nepali":      ("ne-NP-HemkalaNeural", "तपाईंको ओटीपी कोड हो", DEVA),
    "sinhala":     ("si-LK-ThiliniNeural", "ඔබේ OTP කේතය", WEST),
    "georgian":    ("ka-GE-EkaNeural", "თქვენი დადასტურების კოდი არის", GEOR),
    "armenian":    ("ru-RU-SvetlanaNeural", "Ваш код подтверждения", WEST),  # no hy-AM voice — Russian fallback
    "azerbaijani": ("az-AZ-BanuNeural", "Təsdiq kodunuz", WEST),
    "kazakh":      ("kk-KZ-AigulNeural", "Сіздің растау кодыңыз", WEST),
    "uzbek":       ("uz-UZ-MadinaNeural", "Sizning tasdiqlash kodingiz", WEST),
    "icelandic":   ("is-IS-GudrunNeural", "Staðfestingarkóðinn þinn er", WEST),
    "estonian":    ("et-EE-AnuNeural", "Teie kinnituskood on", WEST),
    "latvian":     ("lv-LV-EveritaNeural", "Jūsu verifikācijas kods ir", WEST),
    "lithuanian":  ("lt-LT-OnaNeural", "Jūsų patvirtinimo kodas yra", WEST),
    "bulgarian":   ("bg-BG-KalinaNeural", "Вашият код за потвърждение е", WEST),
    "serbian":     ("sr-RS-SophieNeural", "Ваш код за потврду је", WEST),
    "croatian":    ("hr-HR-GabrijelaNeural", "Vaš verifikacijski kod je", WEST),
    "slovak":      ("sk-SK-ViktoriaNeural", "Váš overovací kód je", WEST),
    "bosnian":     ("bs-BA-VesnaNeural", "Vaš verifikacijski kod je", WEST),
    "albanian":    ("sq-AL-AnilaNeural", "Kodi juaj i verifikimit është", WEST),
    "maltese":     ("mt-MT-GraceNeural", "Il-kodiċi ta' verifikazzjoni tiegħek huwa", WEST),
}

async def synth(text: str, voice: str, out_mp3: str) -> None:
    """Synthesize with retries + polite pacing — Edge rate-limits bursts."""
    last_err = None
    for attempt in range(5):
        try:
            tts = edge_tts.Communicate(text, voice, rate=RATE, pitch=PITCH)
            await tts.save(out_mp3)
            if os.path.getsize(out_mp3) > 0:
                return
            raise RuntimeError("empty output")
        except Exception as e:
            last_err = e
            await asyncio.sleep(4 * (attempt + 1))
    raise RuntimeError(f"synth failed after retries: {last_err}")

async def synth_paced(text: str, voice: str, out_mp3: str) -> None:
    """Synth one file, then wait 1.5s so Edge never sees a burst."""
    await synth(text, voice, out_mp3)
    await asyncio.sleep(1.5)

def to_wav(mp3: str, wav: str) -> None:
    # 24 kHz mono WAV (Asterisk-friendly, matches engine's .wav fallback URLs)
    subprocess.run(
        ["ffmpeg", "-y", "-i", mp3, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav],
        check=True, capture_output=True,
    )

async def main() -> None:
    if not shutil.which("ffmpeg"):
        print("ERROR: ffmpeg not found on PATH"); sys.exit(1)
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    failed = 0
    # Resume: skip languages whose files already exist (all 11 present)
    SKIP = []
    for folder in LANGS:
        lang_dir = os.path.join(OUT_DIR, folder)
        if os.path.isdir(lang_dir):
            have = {f for f in os.listdir(lang_dir) if f.endswith(".wav")}
            need = {"greeting.wav"} | {f"{d}.wav" for d in range(10)}
            if need <= have:
                SKIP.append(folder)
    if SKIP:
        print(f"Skipping {len(SKIP)} complete languages: {', '.join(sorted(SKIP))}")
    with tempfile.TemporaryDirectory() as tmp:
        for folder, (voice, greeting, digits) in sorted(LANGS.items()):
            if folder in SKIP:
                continue
            lang_dir = os.path.join(OUT_DIR, folder)
            os.makedirs(lang_dir, exist_ok=True)
            print(f"== {folder} ({voice}) ==", flush=True)
            # Greeting
            g_mp3 = os.path.join(tmp, "greeting.mp3")
            g_wav = os.path.join(lang_dir, "greeting.wav")
            try:
                await synth_paced(greeting, voice, g_mp3)
                to_wav(g_mp3, g_wav)
                total += 1
            except Exception as e:
                failed += 1; print(f"  FAILED greeting: {e}"); 
            # Digits 0-9
            for d in range(10):
                d_mp3 = os.path.join(tmp, f"d{d}.mp3")
                d_wav = os.path.join(lang_dir, f"{d}.wav")
                try:
                    await synth_paced(digits[d], voice, d_mp3)
                    to_wav(d_mp3, d_wav)
                    total += 1
                except Exception as e:
                    failed += 1; print(f"  FAILED digit {d}: {e}")
    print(f"\nGenerated {total} files, {failed} failed.")

if __name__ == "__main__":
    asyncio.run(main())
