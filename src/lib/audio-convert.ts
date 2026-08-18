import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

// Formats we convert to WAV. Anything else (and WAV itself) is passed through.
const CONVERTIBLE = ["mp3", "ogg", "m4a", "aac", "flac", "wma", "opus"];

/**
 * Convert an uploaded audio file to a telephony-friendly WAV (8 kHz, mono,
 * 16-bit PCM — the format Asterisk/SIP trunks expect) using ffmpeg.
 *
 * Returns the (possibly converted) bytes and the final extension. If the source
 * is already WAV, or ffmpeg is unavailable/fails, the original bytes are
 * returned unchanged so playback still works.
 */
export async function convertToWav(
  input: Buffer,
  sourceExt: string
): Promise<{ buffer: Buffer; ext: string }> {
  const ext = (sourceExt || "").toLowerCase().replace(/^\./, "");

  if (ext === "wav") return { buffer: input, ext: "wav" };
  if (!CONVERTIBLE.includes(ext)) return { buffer: input, ext };

  const tmpDir = path.join(process.cwd(), "public", "uploads", "tmp");
  await mkdir(tmpDir, { recursive: true }).catch(() => {});

  const rand = Math.random().toString(36).slice(2, 10);
  const inPath = path.join(tmpDir, `in_${rand}.${ext}`);
  const outPath = path.join(tmpDir, `out_${rand}.wav`);

  try {
    await writeFile(inPath, input);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inPath,
      "-ar", "8000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      outPath,
    ]);
    const out = await readFile(outPath);
    return { buffer: out, ext: "wav" };
  } catch (e) {
    // Fall back to the original bytes — the browser can still play them and
    // Asterisk can often play mp3/ogg natively.
    console.warn("[VOICE-OTP] ffmpeg conversion failed, keeping original:", (e as Error).message);
    return { buffer: input, ext };
  } finally {
    await rm(inPath, { force: true }).catch(() => {});
    await rm(outPath, { force: true }).catch(() => {});
  }
}
