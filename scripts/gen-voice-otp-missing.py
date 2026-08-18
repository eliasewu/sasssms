#!/usr/bin/env python3
"""
gen-voice-otp-missing.py — fill the remaining builtin Voice OTP audio gaps.

Generates greeting + digits 0-9 for languages in the MCC detection database
that had no builtin folder, using Microsoft Edge neural TTS (free, no key),
then converts to WAV (48 kHz mono) to match the existing builtin set.

Usage:  /opt/edge-tts-venv/bin/python scripts/gen-voice-otp-missing.py
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

WEST = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

# folder | (voice, greeting)
LANGS = {
    "catalan":     ("ca-ES-JoanaNeural", "El vostre codi de verificació és"),
    "lao":         ("lo-LA-KeomanyNeural", "ລະຫັດ OTP ຂອງທ່ານແມ່ນ"),
    "macedonian":  ("mk-MK-MarijaNeural", "Вашиот код за потврда е"),
    "mongolian":   ("mn-MN-YesuiNeural", "Таны баталгаажуулах код бол"),
    "slovenian":   ("sl-SI-PetraNeural", "Vaša koda za preverjanje je"),
}


async def synth(text: str, voice: str, out_mp3: str) -> None:
    last_err = None
    for attempt in range(5):
        try:
            tts = edge_tts.Communicate(text, voice, rate=RATE, pitch=PITCH)
            await tts.save(out_mp3)
            if os.path.getsize(out_mp3) > 0:
                return
            raise RuntimeError("empty output")
        except Exception as e:  # noqa: BLE001
            last_err = e
            await asyncio.sleep(4 * (attempt + 1))
    raise RuntimeError(f"synth failed after retries: {last_err}")


def to_wav(mp3: str, wav: str) -> None:
    # 48 kHz mono WAV — matches the existing builtin set.
    subprocess.run(
        ["ffmpeg", "-y", "-i", mp3, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", wav],
        check=True, capture_output=True,
    )


async def main() -> None:
    if not shutil.which("ffmpeg"):
        print("ERROR: ffmpeg not found on PATH")
        sys.exit(1)
    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0
    failed = 0
    with tempfile.TemporaryDirectory() as tmp:
        for folder, (voice, greeting) in sorted(LANGS.items()):
            lang_dir = os.path.join(OUT_DIR, folder)
            os.makedirs(lang_dir, exist_ok=True)
            print(f"== {folder} ({voice}) ==", flush=True)

            g_mp3 = os.path.join(tmp, "greeting.mp3")
            g_wav = os.path.join(lang_dir, "greeting.wav")
            try:
                await synth(greeting, voice, g_mp3)
                to_wav(g_mp3, g_wav)
                total += 1
                print("  greeting ok", flush=True)
            except Exception as e:  # noqa: BLE001
                failed += 1
                print(f"  FAILED greeting: {e}")
            await asyncio.sleep(1.5)

            for d in range(10):
                d_mp3 = os.path.join(tmp, f"d{d}.mp3")
                d_wav = os.path.join(lang_dir, f"{d}.wav")
                try:
                    await synth(WEST[d], voice, d_mp3)
                    to_wav(d_mp3, d_wav)
                    total += 1
                except Exception as e:  # noqa: BLE001
                    failed += 1
                    print(f"  FAILED digit {d}: {e}")
                await asyncio.sleep(1.5)

    print(f"\nGenerated {total} files, {failed} failed.")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
