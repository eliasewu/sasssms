#!/usr/bin/env python3
"""retry-voice-otp-missing.py — fill in any missing builtin Voice OTP files
(greeting.wav / 0.wav..9.wav per language) using Edge TTS, with long pacing
between requests to dodge Edge rate-limiting.

Run from repo root:
    python3 scripts/retry-voice-otp-missing.py
"""

import asyncio
import os
import shutil
import subprocess
import sys
import tempfile

import edge_tts

OUT_DIR = "public/audio/builtin"
RATE = "-12%"
PITCH = "+2Hz"

# folder -> (voice, greeting, digits[0..9]) — MUST match gen-voice-otp-high-quality.py
LANGS = {
    "english":     ("en-US-AriaNeural", "Your OTP code is", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "spanish":     ("es-ES-ElviraNeural", "Su código de verificación es", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "arabic":      ("ar-EG-SalmaNeural", "رمز التحقق الخاص بك هو", ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]),
    "french":      ("fr-FR-DeniseNeural", "Votre code de vérification est", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "portuguese":  ("pt-BR-FranciscaNeural", "Seu código de verificação é", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "russian":     ("ru-RU-SvetlanaNeural", "Ваш код подтверждения", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "german":      ("de-DE-KatjaNeural", "Ihr Bestätigungscode ist", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "italian":     ("it-IT-ElsaNeural", "Il tuo codice di verifica è", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "dutch":       ("nl-NL-ColetteNeural", "Uw verificatiecode is", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "turkish":     ("tr-TR-EmelNeural", "Doğrulama kodunuz", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "hindi":       ("hi-IN-SwaraNeural", "आपका ओटीपी कोड है", ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"]),
    "bangla":      ("bn-IN-TanishaaNeural", "আপনার ওটিপি কোড হলো", ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]),
    "urdu":        ("ur-PK-UzmaNeural", "آپ کا تصدیقی کوڈ ہے", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "indonesian":  ("id-ID-GadisNeural", "Kode OTP Anda adalah", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "malay":       ("ms-MY-YasminNeural", "Kod OTP anda ialah", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "filipino":    ("fil-PH-BlessicaNeural", "Ang iyong OTP code ay", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "thai":        ("th-TH-PremwadeeNeural", "รหัสยืนยันของคุณคือ", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "vietnamese":  ("vi-VN-HoaiMyNeural", "Mã OTP của bạn là", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "mandarin":    ("zh-CN-XiaoxiaoNeural", "您的验证码是", ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]),
    "japanese":    ("ja-JP-NanamiNeural", "あなたの確認コードは", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "korean":      ("ko-KR-SunHiNeural", "귀하의 인증 코드는", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "cantonese":   ("zh-HK-HiuMaanNeural", "你嘅驗證碼係", ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]),
    "swahili":     ("sw-TZ-RehemaNeural", "Nambari yako ya OTP ni", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "polish":      ("pl-PL-ZofiaNeural", "Twój kod weryfikacyjny to", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "swedish":     ("sv-SE-SofieNeural", "Din verifieringskod är", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "norwegian":   ("nb-NO-PernilleNeural", "Din bekreftelseskode er", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "danish":      ("da-DK-ChristelNeural", "Din bekræftelseskode er", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "finnish":     ("fi-FI-NooraNeural", "Vahvistuskoodisi on", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "ukrainian":   ("uk-UA-PolinaNeural", "Ваш код підтвердження", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "romanian":    ("ro-RO-AlinaNeural", "Codul tău de verificare este", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "czech":       ("cs-CZ-VlastaNeural", "Váš ověřovací kód je", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "hungarian":   ("hu-HU-NoemiNeural", "Az Ön ellenőrző kódja", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "greek":       ("el-GR-AthinaNeural", "Ο κωδικός επαλήθευσής σας είναι", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "hebrew":      ("he-IL-HilaNeural", "קוד האימות שלך הוא", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "persian":     ("fa-IR-DilaraNeural", "کد تأیید شما", ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"]),
    "somali":      ("so-SO-UbaxNeural", "Koodhkaaga OTP waa", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "amharic":     ("am-ET-MekdesNeural", "የእርስዎ OTP ኮድ", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "burmese":     ("my-MM-NilarNeural", "သင့် OTP ကုဒ်မှာ", ["၀", "၁", "၂", "၃", "၄", "၅", "၆", "၇", "၈", "၉"]),
    "khmer":       ("km-KH-SreymomNeural", "លេខកូដ OTP របស់អ្នកគឺ", ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"]),
    "nepali":      ("ne-NP-HemkalaNeural", "तपाईंको ओटीपी कोड हो", ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"]),
    "sinhala":     ("si-LK-ThiliniNeural", "ඔබේ OTP කේතය", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "georgian":    ("ka-GE-EkaNeural", "თქვენი დადასტურების კოდი არის", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "armenian":    ("ru-RU-SvetlanaNeural", "Ваш код подтверждения", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "azerbaijani": ("az-AZ-BanuNeural", "Təsdiq kodunuz", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "kazakh":      ("kk-KZ-AigulNeural", "Сіздің растау кодыңыз", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "uzbek":       ("uz-UZ-MadinaNeural", "Sizning tasdiqlash kodingiz", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "icelandic":   ("is-IS-GudrunNeural", "Staðfestingarkóðinn þinn er", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "estonian":    ("et-EE-AnuNeural", "Teie kinnituskood on", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "latvian":     ("lv-LV-EveritaNeural", "Jūsu verifikācijas kods ir", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "lithuanian":  ("lt-LT-OnaNeural", "Jūsų patvirtinimo kodas yra", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "bulgarian":   ("bg-BG-KalinaNeural", "Вашият код за потвърждение е", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "serbian":     ("sr-RS-SophieNeural", "Ваш код за потврду је", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "croatian":    ("hr-HR-GabrijelaNeural", "Vaš verifikacijski kod je", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "slovak":      ("sk-SK-ViktoriaNeural", "Váš overovací kód je", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "bosnian":     ("bs-BA-VesnaNeural", "Vaš verifikacijski kod je", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "albanian":    ("sq-AL-AnilaNeural", "Kodi juaj i verifikimit është", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
    "maltese":     ("mt-MT-GraceNeural", "Il-kodiċi ta' verifikazzjoni tiegħek huwa", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]),
}


async def synth_with_retries(text: str, voice: str, out_mp3: str) -> None:
    last_err = None
    for attempt in range(8):
        try:
            tts = edge_tts.Communicate(text, voice, rate=RATE, pitch=PITCH)
            await tts.save(out_mp3)
            if os.path.getsize(out_mp3) > 0:
                return
            raise RuntimeError("empty output")
        except Exception as e:
            last_err = e
            await asyncio.sleep(6 * (attempt + 1))
    raise RuntimeError(f"failed after retries: {last_err}")


def to_wav(mp3: str, wav: str) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-i", mp3, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", wav],
        check=True, capture_output=True,
    )


async def main() -> None:
    if not shutil.which("ffmpeg"):
        print("ERROR: ffmpeg not found"); sys.exit(1)
    missing = []
    for folder, (voice, greeting, digits) in sorted(LANGS.items()):
        lang_dir = os.path.join(OUT_DIR, folder)
        need = {"greeting": greeting} | {str(d): digits[d] for d in range(10)}
        for slot, text in need.items():
            if not os.path.isfile(os.path.join(lang_dir, f"{slot}.wav")):
                missing.append((folder, voice, slot, text))
    if not missing:
        print("Nothing missing — all builtin audio present."); return
    print(f"Filling {len(missing)} missing files...")
    failed = 0
    with tempfile.TemporaryDirectory() as tmp:
        for folder, voice, slot, text in missing:
            lang_dir = os.path.join(OUT_DIR, folder)
            os.makedirs(lang_dir, exist_ok=True)
            mp3 = os.path.join(tmp, "x.mp3")
            try:
                await synth_with_retries(text, voice, mp3)
                to_wav(mp3, os.path.join(lang_dir, f"{slot}.wav"))
                print(f"  ✓ {folder}/{slot}.wav", flush=True)
            except Exception as e:
                failed += 1
                print(f"  ✗ {folder}/{slot}.wav: {e}", flush=True)
            await asyncio.sleep(2.5)
    print(f"\nDone: {len(missing) - failed} filled, {failed} still failed.")


if __name__ == "__main__":
    asyncio.run(main())
