"use client";

/** 클로바 보이스 TTS 재생기 — 동시 재생 방지 큐 */
export class SpeechGuide {
  private audio: HTMLAudioElement | null = null;
  private lastText = "";
  private lastAt = 0;
  enabled = true;

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.stop();
  }

  stop() {
    if (this.audio) {
      try {
        this.audio.pause();
      } catch {
        /* ignore */
      }
      this.audio = null;
    }
  }

  /** 같은 문구가 짧은 시간 안에 반복되면 무시 */
  speak(text: string, opts?: { force?: boolean }) {
    if (!this.enabled || typeof window === "undefined") return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (!opts?.force && trimmed === this.lastText && now - this.lastAt < 8000) return;
    this.lastText = trimmed;
    this.lastAt = now;

    this.stop();
    const url = `/api/tts?text=${encodeURIComponent(trimmed)}`;
    const audio = new Audio(url);
    this.audio = audio;
    audio.play().catch(() => {
      /* 자동재생 차단/네트워크 오류 무시 */
    });
  }
}

let singleton: SpeechGuide | null = null;
export function getSpeechGuide(): SpeechGuide {
  if (!singleton) singleton = new SpeechGuide();
  return singleton;
}
