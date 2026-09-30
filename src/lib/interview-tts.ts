/** Shared audio playback for interview TTS — stoppable from UI. */

let currentAudio: HTMLAudioElement | null = null;
let objectUrl: string | null = null;

export function stopInterviewSpeech() {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

function pickBrowserVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefer = [
    /neural/i,
    /natural/i,
    /premium/i,
    /google.*english/i,
    /microsoft.*(aria|jenny|guy|sara)/i,
    /samantha/i,
    /karen/i,
    /moira/i,
  ];
  for (const re of prefer) {
    const hit = voices.find((v) => re.test(v.name) && /^en/i.test(v.lang));
    if (hit) return hit;
  }
  return (
    voices.find((v) => /^en(-|_)?(us|gb|au)/i.test(v.lang)) ??
    voices.find((v) => /^en/i.test(v.lang)) ??
    voices[0] ??
    null
  );
}

function speakBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickBrowserVoice();
    if (voice) utter.voice = voice;
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    // Chrome sometimes needs voices loaded async
    const start = () => window.speechSynthesis.speak(utter);
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const v = pickBrowserVoice();
        if (v) utter.voice = v;
        start();
      };
      // Fallback if event never fires
      setTimeout(start, 250);
    } else {
      start();
    }
  });
}

async function speakApi(text: string): Promise<boolean> {
  const res = await fetch("/api/interview/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return false;
  const blob = await res.blob();
  if (!blob.size) return false;

  stopInterviewSpeech();
  objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  currentAudio = audio;
  await new Promise<void>((resolve) => {
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
  });
  return true;
}

export async function speakInterview(
  text: string,
  opts?: { enabled?: boolean },
): Promise<void> {
  if (!text.trim() || opts?.enabled === false) return;
  if (typeof window === "undefined") return;

  stopInterviewSpeech();
  try {
    const ok = await speakApi(text);
    if (!ok) await speakBrowser(text);
  } catch {
    await speakBrowser(text);
  }
}
