import { requireZongjuSession } from "@/lib/authz";
import { listUpcomingReminders } from "@/lib/reminders";
import { listStudents } from "@/lib/data";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { ReminderManager } from "@/components/admin/ReminderManager";
import { STAFF_SUB_TABS } from "../subTabs";

export default async function AdminRemindersPage() {
  await requireZongjuSession();
  const [reminders, allStudents] = await Promise.all([
    listUpcomingReminders(),
    listStudents({ enrolledOnly: true }),
  ]);
  const students = allStudents.map((s) => ({
    id: s.id,
    name: s.name,
    school: s.school,
    grade: s.grade,
  }));

  return (
    <div>
      <AdminSubNav tabs={STAFF_SUB_TABS} />

      <div className="mt-4 text-[19px] font-extrabold text-ink">잊지마</div>
      <div className="mt-1 text-xs text-ink-muted">
        보강, 교재 픽업, 학부모 방문상담 같은 돌발 일정을 남겨두면 하루 전·1시간 전에 조교·종주T
        전원에게 알림이 가고, 당일에는 홈 화면 상단에 계속 떠 있어요. 학생을 연결하면 그 학생·학부모도
        같이 알림을 받아요.
      </div>

      <div className="mt-4">
        <ReminderManager reminders={reminders} students={students} />
      </div>
    </div>
  );
}
