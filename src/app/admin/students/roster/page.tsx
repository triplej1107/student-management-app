import { requireZongjuSession } from "@/lib/authz";
import { listStudents } from "@/lib/data";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { RosterListManager } from "@/components/admin/RosterListManager";
import { STUDENT_SUB_TABS } from "../subTabs";

export default async function AdminRosterPage() {
  await requireZongjuSession();
  const students = await listStudents();

  return (
    <div>
      <AdminSubNav tabs={STUDENT_SUB_TABS} />
      <div className="mt-4">
        <RosterListManager students={students} />
      </div>
    </div>
  );
}
