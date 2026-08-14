"use client";

import { useEffect, useState } from "react";

/**
 * AudioDuration — shows an audio file's duration in seconds.
 *
 * Loads the file's metadata via the browser (HTML5 Audio) — no server-side
 * audio parsing needed. Returns null (renders nothing) until metadata loads,
 * or if the URL is missing/unreachable.
 */
export default function AudioDuration({ url, className }: { url: string | null; className?: string }) {
  const [dur, setDur] = useState<number | null>(null);

  useEffect(() => {
    if (!url) { setDur(null); return; }
    let audio: HTMLAudioElement | null = new Audio();
    audio.preload = "metadata";
    let cancelled = false;

    const onMeta = () => {
      if (cancelled || !audio) return;
      const d = audio.duration;
      setDur(Number.isFinite(d) ? d : null);
      audio.src = "";
      audio = null;
    };
    const onErr = () => { if (!cancelled) setDur(null); };
    const onLoaded = () => { if (!cancelled) setDur(null); }; // 0-length guard below

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("error", onErr);
    audio.addEventListener("loadeddata", onLoaded);
    audio.src = url;

    return () => {
      cancelled = true;
      if (audio) {
        audio.removeEventListener("loadedmetadata", onMeta);
        audio.removeEventListener("error", onErr);
        audio.removeEventListener("loadeddata", onLoaded);
        audio.src = "";
        audio = null;
      }
    };
  }, [url]);

  if (dur === null || dur <= 0) return null;
  return <span className={className ?? "text-[10px] text-slate-400"} title={`Duration: ${dur.toFixed(1)}s`}>⏱ {dur.toFixed(1)}s</span>;
}
