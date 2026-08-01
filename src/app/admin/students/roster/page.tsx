import { requireZongjuSession } from "@/lib/authz";
import { listStudents } from "@/lib/data";
import { AdminGroupedSubNav } from "@/components/admin/AdminTopNav";
import { RosterListManager } from "@/components/admin/RosterListManager";
import { STUDENT_TAB_GROUPS } from "../subTabs";

export default async function AdminRosterPage() {
  await requireZongjuSession();
  const students = await listStudents();

  return (
    <div>
      <AdminGroupedSubNav groups={STUDENT_TAB_GROUPS} />
      <div className="mt-4">
        <RosterListManager students={students} />
      </div>
    </div>
  );
}
