"use client";

import { useState, useTransition } from "react";
import { resolveReminderAction } from "@/app/reminderActions";
import type { ReminderWithStudent } from "@/lib/types";

/** "6시" / "6시 30분" — event_time("HH:MM")을 구어체로. */
function formatTimeKorean(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const m = Number(mStr);
  return m === 0 ? `${displayHour}시` : `${displayHour}시 ${m}분`;
}

/** 오늘이 event_date인 "잊지마" 항목을 홈 화면 맨 위에 작은 배지로 계속
 * 띄운다. 배지를 누르면 "해결하셨습니까?" 확인창이 뜨고, 예를 누르면
 * 그 항목만 사라진다(서버에는 resolved=true로 반영). */
export function ReminderBadges({ reminders }: { reminders: ReminderWithStudent[] }) {
  const [items, setItems] = useState(reminders);
  const [active, setActive] = useState<ReminderWithStudent | null>(null);
  const [, startTransition] = useTransition();

  if (items.length === 0) return null;

  function resolve(id: number) {
    setItems((prev) => prev.filter((r) => r.id !== id));
    setActive(null);
    startTransition(async () => {
      await resolveReminderAction(id);
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {items.map((r) => (
          <button
            key={r.id}
            onClick={() => setActive(r)}
            className="rounded-full bg-danger px-3 py-1 text-[11px] font-bold text-white shadow-[0_1px_4px_rgba(20,30,60,0.15)]"
          >
            🔔 {formatTimeKorean(r.event_time)}
            {r.studentName ? ` ${r.studentName}` : ""} 잊지마
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl">
            <div className="text-[15px] font-bold leading-relaxed text-ink">
              {formatTimeKorean(active.event_time)}
              {active.studentName ? ` ${active.studentName}` : ""} {active.content}, 해결하셨습니까?
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => resolve(active.id)}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
              >
                예
              </button>
              <button
                onClick={() => setActive(null)}
                className="flex-1 rounded-xl border border-line bg-white py-2.5 text-sm font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
