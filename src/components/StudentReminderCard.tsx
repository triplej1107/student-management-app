import type { Reminder } from "@/lib/types";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatWhen(iso: string, time: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const day = DAY_LABELS[new Date(y, m - 1, d).getDay()];
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const min = Number(mStr);
  const hourText = min === 0 ? `${h}시` : `${h}시 ${min}분`;
  return `${m}/${d}(${day}) ${hourText}`;
}

/** 학생 본인에게 걸린 "잊지마" 일정 — 종주T가 학생을 연결해둔 건만 보인다.
 * 해결 처리는 조교·종주T가 하는 일이라 여기서는 읽기 전용으로만 보여준다. */
export function StudentReminderCard({ reminders }: { reminders: Reminder[] }) {
  if (reminders.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-warn/50 bg-warn-soft p-3.5">
      <div className="mb-2 text-[13px] font-extrabold text-warn">🔔 잊지 마세요!</div>
      <div className="flex flex-col gap-1.5">
        {reminders.map((r) => (
          <div key={r.id} className="rounded-xl bg-white px-3 py-2">
            <div className="text-[11px] font-bold text-warn">
              {formatWhen(r.event_date, r.event_time)}
            </div>
            <div className="mt-0.5 text-[13px] leading-relaxed text-ink">{r.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
