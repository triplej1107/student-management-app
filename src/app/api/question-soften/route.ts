import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const SYSTEM_PROMPT = `너는 국어학원에 다니는 학생의 학부모가 원장님(종주T)에게 남기는 질문 문구를 다듬는 도우미야.
- 학부모가 다소 날카롭거나 직설적으로 쓴 질문을, 원장님이 읽었을 때 부담스럽거나 공격적으로 느껴지지 않도록 정중하고 부드러운 어조로 다듬어줘.
- 질문에 담긴 요청사항·우려·궁금한 점의 내용은 절대 바꾸지 마 — 말투와 표현만 다듬어.
- 원장님께 보내는 존댓말(해요체)로 쓰고, 길이는 원문과 비슷하게 유지해.
- 결과는 다듬어진 질문 문장만 출력해. 따옴표나 설명 없이.`;

export async function POST(req: Request) {
  const session = await getSession();
  if (session.role !== "parent") {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "서버에 API 키가 설정되지 않았어요." }, { status: 500 });
  }

  let text: string;
  try {
    const body = await req.json();
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "다듬을 질문을 먼저 입력해주세요." }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        temperature: 0.7,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `[학부모 질문 — 이 내용을 부드럽게 다듬어줘]\n${text}` }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[question-soften] Anthropic API error", res.status, errText);
      return NextResponse.json({ error: "다듬기에 실패했어요." }, { status: 502 });
    }

    const data = await res.json();
    const softened = data.content?.[0]?.text?.trim() ?? "";
    return NextResponse.json({ text: softened });
  } catch (e) {
    console.error("[question-soften] fetch failed", e);
    return NextResponse.json({ error: "다듬기에 실패했어요." }, { status: 502 });
  }
}
