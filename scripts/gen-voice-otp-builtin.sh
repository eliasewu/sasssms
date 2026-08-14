#!/usr/bin/env bash
# gen-voice-otp-builtin.sh — generate builtin Voice OTP audio (greeting + 0-9)
# for the 15 non-English languages, using Google Translate TTS (free, MP3).
#
# The original uploaded defaults were lost (deploy rsync --delete wiped
# public/uploads), so this regenerates playable defaults into the committed
# builtin set at public/audio/builtin/<lang>/.  Tenants can still override
# with their own uploads later.
#
# Usage:  bash scripts/gen-voice-otp-builtin.sh
# Output: public/audio/builtin/{arabic,bangla,german,hindi,indonesian,japanese,
#          korean,malay,persian,russian,spanish,thai,urdu,uzbek,vietnamese}/...

set -euo pipefail
cd "$(dirname "$0")/.."

UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
REF="https://translate.google.com/"
OUT_DIR="public/audio/builtin"

# <folder>|<tts-lang>|<greeting text in that language>
declare -a LANGS=(
  "arabic|ar|رمز التحقق الخاص بك هو"
  "bangla|bn|আপনার ওটিপি কোড হলো"
  "german|de|Ihr OTP-Code ist"
  "hindi|hi|आपका ओटीपी कोड है"
  "indonesian|id|Kode OTP Anda adalah"
  "japanese|ja|あなたのワンタイムパスワードは"
  "korean|ko|귀하의 OTP 코드는"
  "malay|ms|Kod OTP anda ialah"
  "persian|fa|کد تأیید شما"
  "russian|ru|Ваш код подтверждения"
  "spanish|es|Su código OTP es"
  "thai|th|รหัส OTP ของคุณคือ"
  "urdu|ur|آپ کا OTP کوڈ ہے"
  "uzbek|uz|Sizning OTP kodingiz"
  "vietnamese|vi|Mã OTP của bạn là"
)

fetch_tts() { # $1=lang, $2=text, $3=outfile
  curl -s --max-time 30 -o "$3" \
    "https://translate.google.com/translate_tts?ie=UTF-8&q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$2")&tl=$1&client=tw-ob" \
    -H "User-Agent: $UA" -H "Referer: $REF"
  if [ ! -s "$3" ] || ! file "$3" | grep -qi 'MPEG\|audio'; then
    echo "  FAILED: $2 ($1)"
    rm -f "$3"
    return 1
  fi
  return 0
}

total=0; failed=0
for entry in "${LANGS[@]}"; do
  folder="${entry%%|*}"; rest="${entry#*|}"; ttslang="${rest%%|*}"; greeting="${rest#*|}"
  mkdir -p "$OUT_DIR/$folder"
  echo "== $folder ($ttslang) =="
  # greeting
  if fetch_tts "$ttslang" "$greeting" "$OUT_DIR/$folder/greeting.mp3"; then total=$((total+1)); else failed=$((failed+1)); fi
  # digits 0-9 (pass the digit as text — TTS reads it in the target language)
  for d in 0 1 2 3 4 5 6 7 8 9; do
    if fetch_tts "$ttslang" "$d" "$OUT_DIR/$folder/$d.mp3"; then total=$((total+1)); else failed=$((failed+1)); fi
  done
done

echo ""
echo "Generated $total files, $failed failed."
[ "$failed" -eq 0 ] || exit 1
