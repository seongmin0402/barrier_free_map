"use client";

import { useCallback, useRef, useState } from "react";
import type { AppLocale } from "@/lib/app-settings";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(locale: AppLocale) {
  const [listening, setListening] = useState(false);
  const [errorKey, setErrorKey] = useState<"unsupported" | "failed" | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(
    (onResult: (transcript: string) => void) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setErrorKey("unsupported");
        return;
      }

      stop();
      setErrorKey(null);

      const recognition = new Ctor();
      recognition.lang = locale === "en" ? "en-US" : "ko-KR";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) onResult(transcript);
      };

      recognition.onerror = () => {
        setErrorKey("failed");
        setListening(false);
        recognitionRef.current = null;
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setListening(true);
      try {
        recognition.start();
      } catch {
        setErrorKey("failed");
        setListening(false);
        recognitionRef.current = null;
      }
    },
    [locale, stop],
  );

  return { listening, errorKey, start, stop };
}
