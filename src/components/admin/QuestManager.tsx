"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import type { QuestPreset, QuestWithStage } from "@/lib/quests";
import type { QuestStage } from "@/lib/questStages";
import {
  addQuestPresetAction,
  deleteQuestAction,
  deleteQuestPresetAction,
  sendQuestAction,
} from "@/app/questActions";

const STAGE_LABEL: Record<QuestStage, string> = {
  sent: "보냄 · 조교 확인 전",
  acked: "조교가 하는 중",
  done: "완료 · 확인해주세요",
  feedback: "피드백 전달함",
  closed: "끝",
};

const STAGE_STYLE: Record<QuestStage, string> = {
  sent: "bg-warn-soft text-warn",
  acked: "bg-accent-soft text-accent",
  done: "bg-success-soft text-success",
  feedback: "bg-accent-soft text-accent",
  closed: "bg-line-soft text-ink-muted",
};

export function QuestManager({
  presets,
  recent,
}: {
  presets: QuestPreset[];
  recent: QuestWithStage[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [freeText, setFreeText] = useState("");
  const [newPreset, setNewPreset] = useState("");
  const [editingPresets, setEditingPresets] = useState(false);

  function send(content: string, clear?: () => void) {
    startTransition(async () => {
      try {
        await sendQuestAction(content);
        clear?.();
        showToast("조교 화면에 띄웠어요");
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "보내지 못했어요.", "error");
      }
    });
  }

  return (
    <div>
      <div className="rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold text-ink">자주 쓰는 요청</div>
          <button
            onClick={() => setEditingPresets((v) => !v)}
            className="rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-ink-secondary"
          >
            {editingPresets ? "완료" : "문구 관리"}
          </button>
        </div>
        <div className="mt-1 text-[11px] text-ink-muted">
          누르면 조교 화면에 바로 팝업으로 떠요.
        </div>

        <div className="mt-2.5 flex flex-col gap-1.5">
          {presets.length === 0 && (
            <div className="text-[13px] text-ink-muted/70">
              저장해둔 문구가 없어요. &ldquo;문구 관리&rdquo;에서 추가해보세요.
            </div>
          )}
          {presets.map((p) => (
            <div key={p.id} className="flex gap-1.5">
              <button
                disabled={pending}
                onClick={() => send(p.content)}
                className="flex-1 rounded-xl border border-accent bg-accent-soft px-3 py-2.5 text-left text-[13px] font-bold text-accent disabled:opacity-50"
              >
                ⚡ {p.content}
              </button>
              {editingPresets && (
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteQuestPresetAction(p.id);
                      router.refresh();
                    })
                  }
                  className="flex-none rounded-xl border border-danger-soft bg-danger-soft px-2.5 text-[11px] font-bold text-danger disabled:opacity-50"
                >
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>

        {editingPresets && (
          <div className="mt-2.5 flex gap-1.5 border-t border-line-soft pt-2.5">
            <input
              value={newPreset}
              onChange={(e) => setNewPreset(e.target.value)}
              placeholder="예: 정수기 물통 갈아주세요"
              className="flex-1 rounded-lg border border-line px-2.5 py-2 text-[13px]"
            />
            <button
              disabled={pending || !newPreset.trim()}
              onClick={() =>
                startTransition(async () => {
                  await addQuestPresetAction(newPreset);
                  setNewPreset("");
                  router.refresh();
                })
              }
              className="flex-none rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              추가
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="text-sm font-extrabold text-ink">직접 쓰기</div>
        <textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="예: 3층 복사기 토너 갈아주세요"
          className="mt-2 min-h-[60px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
        />
        <button
          disabled={pending || !freeText.trim()}
          onClick={() => send(freeText, () => setFreeText(""))}
          className="mt-2 w-full rounded-xl bg-accent py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          조교에게 보내기
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[13px] font-bold text-ink">최근 보낸 것</div>
        {recent.length === 0 && (
          <div className="text-[13px] text-ink-muted/70">아직 보낸 요청이 없어요.</div>
        )}
        <div className="flex flex-col gap-1.5">
          {recent.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-line-soft bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-ink">{q.content}</div>
                <div className="mt-0.5 text-[11px] text-ink-muted">
                  {q.doneByName && `${q.doneByName} · `}
                  {q.feedback && `피드백: ${q.feedback}`}
                </div>
              </div>
              <div className="flex flex-none items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-bold ${STAGE_STYLE[q.stage]}`}
                >
                  {STAGE_LABEL[q.stage]}
                </span>
                <button
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("이 요청을 지울까요?")) return;
                    startTransition(async () => {
                      await deleteQuestAction(q.id);
                      router.refresh();
                    });
                  }}
                  className="rounded-md border border-line px-1.5 py-1 text-[10px] font-bold text-ink-muted disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
