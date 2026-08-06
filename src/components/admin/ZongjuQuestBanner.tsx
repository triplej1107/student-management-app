"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QuestWithStage } from "@/lib/quests";
import { reviewQuestAction } from "@/app/questActions";

/**
 * 종주T 홈의 "잊지마" 바로 아래 줄. 조교가 끝낸 돌발퀘스트를 한 줄로 띄우고,
 * 누르면 피드백을 쓰거나 그냥 확인만 하고 넘어갈 수 있다.
 */
export function ZongjuQuestBanner({ quests }: { quests: QuestWithStage[] }) {
  const [active, setActive] = useState<QuestWithStage | null>(null);

  if (quests.length === 0) return null;

  return (
    <>
      <div className="mb-3 flex flex-col gap-1.5">
        {quests.map((q) => (
          <button
            key={q.id}
            onClick={() => setActive(q)}
            className="flex items-center justify-between gap-2 rounded-xl bg-success-soft px-3 py-2 text-left"
          >
            <div className="min-w-0 text-[13px] font-bold leading-snug text-ink">
              ✅ {q.content}
            </div>
            <span className="flex-none text-[11px] font-bold text-success">
              {q.doneByName ? `${q.doneByName} 완료` : "완료"}
            </span>
          </button>
        ))}
      </div>

      {active && <ReviewDialog quest={active} onClose={() => setActive(null)} />}
    </>
  );
}

function ReviewDialog({ quest, onClose }: { quest: QuestWithStage; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState("");

  function submit() {
    startTransition(async () => {
      await reviewQuestAction(quest.id, feedback);
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-[330px] rounded-2xl bg-white p-4 shadow-[0_10px_40px_rgba(20,30,60,0.3)]">
        <div className="text-[11px] font-bold text-ink-muted">
          {quest.doneByName ? `${quest.doneByName} 조교 완료` : "완료됨"}
        </div>
        <div className="mt-1 text-[15px] font-extrabold leading-snug text-ink">{quest.content}</div>

        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="피드백 (선택 — 쓰면 조교 화면에 뜨고, 비우면 그냥 끝나요)"
          className="mt-3 min-h-[70px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
        />

        <div className="mt-3 flex gap-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink-secondary disabled:opacity-50"
          >
            닫기
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="ml-auto flex-1 rounded-lg bg-accent py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {pending ? "처리 중..." : feedback.trim() ? "피드백 보내기" : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}
