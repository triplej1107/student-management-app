"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QuestWithStage } from "@/lib/quests";
import {
  ackQuestAction,
  completeQuestAction,
  seeQuestFeedbackAction,
} from "@/app/questActions";

/**
 * 조교 홈의 "잊지마" 바로 아래 줄. 돌발퀘스트를 한 줄로 보여주고 확인·완료를
 * 그 자리에서 체크한다. 아직 확인 안 한 게 있으면 팝업으로 먼저 알린다.
 */
export function StaffQuestBanner({ quests }: { quests: QuestWithStage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // 팝업은 이번 화면에서 한 번만 — 닫고 나면 아래 줄로 계속 보인다.
  const [dismissedPopup, setDismissedPopup] = useState(false);

  if (quests.length === 0) return null;

  const unseen = quests.filter((q) => q.stage === "sent");
  const showPopup = !dismissedPopup && unseen.length > 0;

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-col gap-1.5">
        {quests.map((q) => (
          <div
            key={q.id}
            className={
              "rounded-xl px-3 py-2 " +
              (q.stage === "feedback"
                ? "bg-accent-soft"
                : "bg-warn-soft border border-warn/40")
            }
          >
            {q.stage === "feedback" ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-[13px] leading-snug text-ink">
                  <span className="font-extrabold text-accent">종주T 피드백</span>{" "}
                  <span className="font-semibold">{q.feedback}</span>
                  <div className="mt-0.5 truncate text-[11px] text-ink-muted">{q.content}</div>
                </div>
                <button
                  disabled={pending}
                  onClick={() => run(() => seeQuestFeedbackAction(q.id))}
                  className="flex-none rounded-lg bg-accent px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  확인
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-[13px] font-bold leading-snug text-ink">
                  ⚡ {q.content}
                </div>
                <div className="flex flex-none gap-1">
                  <CheckBox
                    label="확인"
                    checked={q.stage !== "sent"}
                    disabled={pending || q.stage !== "sent"}
                    onClick={() => run(() => ackQuestAction(q.id))}
                  />
                  <CheckBox
                    label="완료"
                    checked={false}
                    disabled={pending}
                    onClick={() => run(() => completeQuestAction(q.id))}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-[320px] rounded-2xl bg-white p-5 text-center shadow-[0_10px_40px_rgba(20,30,60,0.3)]">
            <div className="text-[28px]">⚡</div>
            <div className="mt-1 text-[13px] font-bold text-ink-muted">돌발퀘스트</div>
            <div className="mt-2 flex flex-col gap-2">
              {unseen.map((q) => (
                <div key={q.id} className="text-[16px] font-extrabold leading-snug text-ink">
                  {q.content}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setDismissedPopup(true);
                run(async () => {
                  for (const q of unseen) await ackQuestAction(q.id);
                });
              }}
              disabled={pending}
              className="mt-4 w-full rounded-xl bg-accent py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              확인했어요
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function CheckBox({
  label,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "flex items-center gap-0.5 rounded-lg border px-1.5 py-1 text-[11px] font-bold disabled:opacity-60 " +
        (checked ? "border-success bg-success-soft text-success" : "border-line bg-white text-ink-muted")
      }
    >
      <span className="text-[12px] leading-none">{checked ? "☑" : "☐"}</span>
      {label}
    </button>
  );
}
