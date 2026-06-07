"use client";

import type { AppLocale } from "@/lib/app-settings";

/** Google Cloud TTS 재생기 — 동시·중첩 재생 방지 */
export class SpeechGuide {
  private audio: HTMLAudioElement | null = null;
  private objectUrl: string | null = null;
  private lastText = "";
  private lastAt = 0;
  /** speak() 호출마다 증가 — 이전 fetch 완료 시 재생하지 않음 */
  private generation = 0;
  private abortController: AbortController | null = null;
  enabled = true;

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.stop();
  }

  private invalidatePending() {
    this.generation += 1;
    this.abortController?.abort();
    this.abortController = null;
  }

  stop() {
    this.invalidatePending();
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch {
        /* ignore */
      }
      this.audio = null;
    }
    if (this.objectUrl) {
      try {
        URL.revokeObjectURL(this.objectUrl);
      } catch {
        /* ignore */
      }
      this.objectUrl = null;
    }
  }

  /** 같은 문구가 짧은 시간 안에 반복되면 무시 (force여도 동일) */
  speak(text: string, opts?: { force?: boolean; locale?: AppLocale }) {
    if (!this.enabled || typeof window === "undefined") return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = Date.now();
    if (trimmed === this.lastText && now - this.lastAt < 5000) return;

    this.lastText = trimmed;
    this.lastAt = now;

    this.stop();

    const gen = this.generation;
    const lang = opts?.locale ?? "ko";
    const url = `/api/tts?text=${encodeURIComponent(trimmed)}&lang=${lang}`;
    const controller = new AbortController();
    this.abortController = controller;

    void (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (gen !== this.generation) return;
        if (!res.ok) return;
        const blob = await res.blob();
        if (gen !== this.generation || !blob.size) return;

        const objectUrl = URL.createObjectURL(blob);
        if (gen !== this.generation) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        this.objectUrl = objectUrl;
        const audio = new Audio(objectUrl);
        this.audio = audio;
        audio.onended = () => {
          if (this.audio === audio) this.stop();
        };

        await audio.play();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        /* 자동재생 차단/네트워크 오류 무시 */
      }
    })();
  }

  /** 재생이 끝날 때까지 대기 — 안내 시작 전 요약 후 출발 안내 순차 재생 */
  speakAndWait(text: string, opts?: { force?: boolean; locale?: AppLocale }): Promise<void> {
    if (!this.enabled || typeof window === "undefined") return Promise.resolve();
    const trimmed = text.trim();
    if (!trimmed) return Promise.resolve();

    const now = Date.now();
    if (!opts?.force && trimmed === this.lastText && now - this.lastAt < 5000) {
      return Promise.resolve();
    }

    this.lastText = trimmed;
    this.lastAt = now;
    this.stop();

    const gen = this.generation;
    const lang = opts?.locale ?? "ko";
    const url = `/api/tts?text=${encodeURIComponent(trimmed)}&lang=${lang}`;
    const controller = new AbortController();
    this.abortController = controller;

    return new Promise((resolve) => {
      const finish = () => resolve();

      void (async () => {
        try {
          const res = await fetch(url, { signal: controller.signal });
          if (gen !== this.generation) {
            finish();
            return;
          }
          if (!res.ok) {
            finish();
            return;
          }
          const blob = await res.blob();
          if (gen !== this.generation || !blob.size) {
            finish();
            return;
          }

          const objectUrl = URL.createObjectURL(blob);
          if (gen !== this.generation) {
            URL.revokeObjectURL(objectUrl);
            finish();
            return;
          }

          this.objectUrl = objectUrl;
          const audio = new Audio(objectUrl);
          this.audio = audio;
          audio.onended = () => {
            if (this.audio === audio) this.stop();
            finish();
          };
          audio.onerror = () => finish();

          await audio.play();
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            finish();
            return;
          }
          finish();
        }
      })();
    });
  }
}

let singleton: SpeechGuide | null = null;
export function getSpeechGuide(): SpeechGuide {
  if (!singleton) singleton = new SpeechGuide();
  return singleton;
}
