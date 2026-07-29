import { requireStaffSession } from "@/lib/authz";
import { getClinicBacklog, currentBacklogEvalWeek } from "@/lib/clinicBacklog";
import { getClinicContactLogs } from "@/lib/clinicContactLog";
import { ClinicBacklogView } from "@/components/ClinicBacklogView";
import { ScreenTitle } from "@/components/ui";
import { toggleContactAction, saveContactNoteAction } from "./actions";

export default async function StaffClinicBacklogPage() {
  await requireStaffSession();
  const entries = await getClinicBacklog();
  const twoPlusIds = entries.filter((e) => e.weeksOverdue >= 2).map((e) => e.studentId);
  const contactLogs = await getClinicContactLogs(currentBacklogEvalWeek(), twoPlusIds);

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <ScreenTitle>클리닉 밀림 관리</ScreenTitle>
      <div className="mt-1 text-xs text-ink-muted">
        밀린 주차 수가 많은 순으로 정렬돼요. 밀림이 있으면 학생·학부모에게 매주 자동으로 웹 푸시가
        발송되고(2주 이상은 더 강한 경고 문구), 2주 이상 밀리면 전화 연락도 필요해요.
      </div>
      <ClinicBacklogView
        entries={entries}
        contactLogs={contactLogs}
        detailHref={(e) => `/staff/clinic/${e.studentId}?week=${e.oldestIncompleteWeekISO}`}
        toggleAction={toggleContactAction}
        saveNoteAction={saveContactNoteAction}
      />
    </div>
  );
}
