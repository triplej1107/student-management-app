import { requireZongjuSession } from "@/lib/authz";
import { getClinicBacklog, currentBacklogEvalWeek } from "@/lib/clinicBacklog";
import { getClinicContactLogs } from "@/lib/clinicContactLog";
import { ClinicBacklogView } from "@/components/ClinicBacklogView";
import { AdminGroupedSubNav } from "@/components/admin/AdminTopNav";
import { STUDENT_TAB_GROUPS } from "../students/subTabs";
import { toggleContactAction, saveContactNoteAction, clearBacklogAction, clearBacklogEntriesAction } from "./actions";

export default async function ClinicBacklogPage() {
  await requireZongjuSession();
  const entries = await getClinicBacklog();
  const twoPlusIds = entries.filter((e) => e.weeksOverdue >= 2).map((e) => e.studentId);
  const contactLogs = await getClinicContactLogs(currentBacklogEvalWeek(), twoPlusIds);

  return (
    <div>
      <AdminGroupedSubNav groups={STUDENT_TAB_GROUPS} />
      <div className="mt-4 text-[19px] font-extrabold text-ink">클리닉 밀림 관리</div>
      <div className="mt-1 text-xs text-ink-muted">
        밀린 주차 수가 많은 순으로 정렬돼요. 밀림이 있으면 학생·학부모에게 매주 자동으로 웹 푸시가
        발송되고(2주 이상은 더 강한 경고 문구), 2주 이상 밀리면 전화 연락도 필요해요.
      </div>
      <ClinicBacklogView
        entries={entries}
        contactLogs={contactLogs}
        detailHrefBase="/admin/students/approvals"
        toggleAction={toggleContactAction}
        saveNoteAction={saveContactNoteAction}
        clearAction={clearBacklogAction}
        bulkClearAction={clearBacklogEntriesAction}
      />
    </div>
  );
}
