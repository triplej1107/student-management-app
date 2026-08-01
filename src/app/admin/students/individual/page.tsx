import { requireZongjuSession } from "@/lib/authz";
import { AdminGroupedSubNav } from "@/components/admin/AdminTopNav";
import { IndividualManager } from "@/components/admin/IndividualManager";
import { STUDENT_TAB_GROUPS } from "../subTabs";

export default async function AdminIndividualPage() {
  await requireZongjuSession();

  return (
    <div>
      <AdminGroupedSubNav groups={STUDENT_TAB_GROUPS} />
      <IndividualManager />
    </div>
  );
}
