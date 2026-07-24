import { requireZongjuSession } from "@/lib/authz";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { IndividualManager } from "@/components/admin/IndividualManager";
import { STUDENT_SUB_TABS } from "../subTabs";

export default async function AdminIndividualPage() {
  await requireZongjuSession();

  return (
    <div>
      <AdminSubNav tabs={STUDENT_SUB_TABS} />
      <IndividualManager />
    </div>
  );
}
