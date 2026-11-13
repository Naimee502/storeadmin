// Browser voice (free): speech-to-text and text-to-speech in the chosen language.
export type AiLang = "en" | "hi" | "gu";
export const AI_LANGS: Array<[AiLang, string]> = [["en", "English"], ["hi", "हिंदी"], ["gu", "ગુજરાતી"]];
const BCP: Record<AiLang, string> = { en: "en-IN", hi: "hi-IN", gu: "gu-IN" };

export const getAiLang = (): AiLang => {
  try { const l = localStorage.getItem("aiLang") as AiLang; return l && l in BCP ? l : "en"; } catch { return "en"; }
};
export const setAiLang = (l: AiLang) => {
  try { localStorage.setItem("aiLang", l); } catch { /* this visit only */ }
};

const Recognition: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
export const canListen = !!Recognition;
export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

/** Listens once; resolves with what was said ("" when nothing). */
export const listen = (lang: AiLang): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error("Voice typing is not available in this browser. Try Chrome."));
    const r = new Recognition();
    r.lang = BCP[lang];
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e: any) => resolve(String(e.results?.[0]?.[0]?.transcript || ""));
    r.onerror = (e: any) => reject(new Error(e?.error === "not-allowed" ? "Allow the microphone for this site." : "Could not hear that. Try again."));
    r.onend = () => resolve("");
    r.start();
  });

const voiceFor = (lang: AiLang) => {
  const code = BCP[lang].toLowerCase();
  const all = window.speechSynthesis.getVoices();
  return all.find((v) => v.lang?.toLowerCase().replace("_", "-") === code) || all.find((v) => v.lang?.toLowerCase().startsWith(code.slice(0, 2)));
};
// Chrome loads its voice list late; ask early so the first Play has it.
if (canSpeak) window.speechSynthesis.getVoices();

/** True when this device has a voice for the language. */
export const hasVoice = (lang: AiLang) => !canSpeak || lang === "en" || !window.speechSynthesis.getVoices().length || !!voiceFor(lang);

/** Reads text aloud with a voice for the language, if the device has one. */
export const speak = (text: string, lang: AiLang) => {
  if (!canSpeak || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = BCP[lang];
  const voice = voiceFor(lang);
  if (voice) u.voice = voice;
  u.rate = 0.95;
  synth.speak(u);
};
export const stopSpeaking = () => { if (canSpeak) window.speechSynthesis.cancel(); };
