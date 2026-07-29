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
        밀린 주차 수가 많은 순으로 정렬돼요. 1주 밀림은 학생·학부모에게 자동으로 웹 푸시가 발송되고,
        2주 이상 밀리면 전화 연락이 필요해요.
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
