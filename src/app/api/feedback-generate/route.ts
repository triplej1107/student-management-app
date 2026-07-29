import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { FEEDBACK_CATEGORIES, type FeedbackTags } from "@/lib/types";

const SYSTEM_PROMPT = `너는 국어학원 조교가 남긴 학생 태도 체크 태그를 학부모에게 보낼 주간 피드백 문장으로 다듬는 도우미야.
- 어투: 따뜻하고 격려하는 학원 피드백 어투. 존댓말.
- 길이: 2~3문장.
- 태그가 긍정적이면 칭찬 위주로, 개선이 필요한 항목이 있으면 부드럽게 언급하되 마지막은 격려로 마무리해.
- 선택되지 않은(비어있는) 카테고리는 언급하지 마.
- 학생 이름이나 존재하지 않는 사실을 지어내지 마. 태그에 있는 내용만 근거로 써.
- 결과는 문장만 출력해. 따옴표나 제목 없이.`;

export async function POST(req: Request) {
  const session = await getSession();
  if (session.role !== "staff" && session.role !== "zongju") {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "서버에 API 키가 설정되지 않았어요." }, { status: 500 });
  }

  let tags: FeedbackTags;
  try {
    const body = await req.json();
    tags = body.tags ?? {};
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const lines = FEEDBACK_CATEGORIES.map(({ key, label }) => {
    const value = tags[key];
    return value ? `${label}: ${value}` : null;
  }).filter(Boolean);

  if (lines.length === 0) {
    return NextResponse.json({ error: "선택된 태그가 없어요." }, { status: 400 });
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
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: lines.join("\n") }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[feedback-generate] Anthropic API error", res.status, errText);
      return NextResponse.json({ error: "피드백 생성에 실패했어요." }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() ?? "";
    return NextResponse.json({ text });
  } catch (e) {
    console.error("[feedback-generate] fetch failed", e);
    return NextResponse.json({ error: "피드백 생성에 실패했어요." }, { status: 502 });
  }
}
