import { NextRequest } from "next/server";

export const runtime = "nodejs";

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

const VOICES: Record<string, { languageCode: string; name: string }> = {
  ko: { languageCode: "ko-KR", name: "ko-KR-Neural2-A" },
  en: { languageCode: "en-US", name: "en-US-Neural2-F" },
};

export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text")?.trim();
  const lang = req.nextUrl.searchParams.get("lang")?.trim() || "ko";
  const voiceConfig = VOICES[lang] ?? VOICES.ko;
  const voiceName = req.nextUrl.searchParams.get("voice")?.trim() || voiceConfig.name;

  if (!text) {
    return new Response(JSON.stringify({ error: "text 파라미터가 필요합니다." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY ?? "";
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: ".env.local 에 GOOGLE_TTS_API_KEY 를 설정하세요.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const body = {
    input: { text },
    voice: {
      languageCode: voiceConfig.languageCode,
      name: voiceName,
      ssmlGender: "FEMALE",
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: 1.0,
      pitch: 0,
    },
  };

  try {
    const res = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `Google TTS 오류 (${res.status})`, detail }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) {
      return new Response(JSON.stringify({ error: "audioContent 응답이 없습니다." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const audio = Buffer.from(data.audioContent, "base64");
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Google TTS 요청 실패", detail: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
