import type { MakeupSchedule } from "@/lib/types";

/**
 * 점검표 위에 붙는 "조교 전달사항" — 일정을 조정하면서 다음 조교에게 남긴 메모.
 *
 * 조교와 종주T 화면에서만 쓴다. 학생·학부모 점검표(ClinicChecklistReadOnly)에는
 * 절대 넣지 말 것 — 조교들끼리 주고받는 내용이라 학생이 볼 글이 아니다.
 * 같은 이유로 자동 결석·지각 알림 문구에도 이 메모는 안 담는다
 * (staff/attendance/actions.ts 참고).
 */
export function ClinicStaffNote({ makeup }: { makeup: MakeupSchedule | null }) {
  if (!makeup?.note?.trim()) return null;

  return (
    <div className="mt-3 rounded-xl border border-warn/40 bg-warn-soft/50 px-3 py-2.5">
      <div className="text-[11px] font-extrabold text-warn">📌 조교 전달사항</div>
      <div className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
        {makeup.note}
      </div>
      <div className="mt-1 text-[11px] text-ink-muted">
        대체: {makeup.makeup_day} {makeup.makeup_time} · 학생·학부모에게는 안 보여요
      </div>
    </div>
  );
}
