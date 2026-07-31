import { requireZongjuSession } from "@/lib/authz";
import { listAllOnboardings } from "@/lib/newStudents";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { NewStudentManager } from "@/components/admin/NewStudentManager";
import { STAFF_SUB_TABS } from "../subTabs";

export default async function AdminNewStudentsPage() {
  await requireZongjuSession();
  const onboardings = await listAllOnboardings();

  return (
    <div>
      <AdminSubNav tabs={STAFF_SUB_TABS} />

      <div className="mt-4 text-[19px] font-extrabold text-ink">아싸신규</div>
      <div className="mt-1 text-xs text-ink-muted">
        단톡으로 신규 안내가 오면 이름·학교·학년만 적어두세요. 조교·종주T 홈 화면에 챙길 항목 6개가
        체크리스트로 뜨고, 전부 체크해야 사라져요.
      </div>

      <div className="mt-4">
        <NewStudentManager onboardings={onboardings} />
      </div>
    </div>
  );
}
