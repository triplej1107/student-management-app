import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { FEEDBACK_CATEGORIES, type FeedbackTags } from "@/lib/types";
import { getRecentFeedbackTexts } from "@/lib/data";

const SYSTEM_PROMPT = `너는 국어학원 조교가 남긴 학생 태도 체크 태그를 학부모에게 보낼 주간 피드백 문장으로 다듬는 도우미야.
- 읽는 사람은 학부모, 문장에서 서술되는 대상은 학생이야.
- 문장 끝맺음은 학부모께 보고하는 정중한 어투(해요체)로 쓰되, 학생의 행동에는 높임법(-시-, -하셨-, -해주셨- 등 주체 존대)을 쓰지 마. 학생은 존대의 대상이 아니라 서술의 주체야.
  예: "수업에 적극적으로 참여했어요" (O) / "수업에 적극적으로 참여해주셨어요" (X), "태도가 좋아졌어요" (O) / "좋아지셨어요" (X)
- 길이: 2~3문장.
- 태그가 긍정적이면 칭찬 위주로, 개선이 필요한 항목이 있으면 부드럽게 언급하되 마지막은 격려로 마무리해.
- 선택되지 않은(비어있는) 카테고리는 언급하지 마.
- 학생 이름이나 존재하지 않는 사실을 지어내지 마. 태그에 있는 내용만 근거로 써.
- 매주 같은 태그가 선택되더라도 표현이 겹치지 않도록, 아래에 함께 주어지는 "이전 피드백"과는 다른 어휘와 문장 구조를 사용해.
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
  let studentId: number | undefined;
  let weekStartISO: string | undefined;
  try {
    const body = await req.json();
    tags = body.tags ?? {};
    studentId = typeof body.studentId === "number" ? body.studentId : undefined;
    weekStartISO = typeof body.weekStartISO === "string" ? body.weekStartISO : undefined;
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

  const recentFeedbacks =
    studentId && weekStartISO ? await getRecentFeedbackTexts(studentId, weekStartISO) : [];

  const userContent =
    recentFeedbacks.length > 0
      ? `[이번 주 태그]\n${lines.join("\n")}\n\n[이전 피드백 — 이것과 다른 표현으로 써줘]\n${recentFeedbacks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : lines.join("\n");

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
        temperature: 1,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
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
