import { requireZongjuSession } from "@/lib/authz";
import { getReferralScholarships, getGradeScholarships } from "@/lib/scholarships";
import { AdminGroupedSubNav } from "@/components/admin/AdminTopNav";
import { ScholarshipBoard } from "@/components/admin/ScholarshipBoard";
import { STUDENT_TAB_GROUPS } from "../subTabs";

export default async function AdminScholarshipsPage() {
  await requireZongjuSession();

  const [referrals, gradeData] = await Promise.all([
    getReferralScholarships(),
    getGradeScholarships(),
  ]);

  return (
    <div>
      <AdminGroupedSubNav groups={STUDENT_TAB_GROUPS} />

      <div className="mt-4 text-[19px] font-extrabold text-ink">장학금 관리</div>
      <div className="mt-1 text-xs text-ink-muted">
        누구에게 언제 줘야 하는지 자동으로 뽑아줘요. 준 건 체크해두면 다음에 안 뜹니다.
      </div>

      <ScholarshipBoard referrals={referrals} gradeData={gradeData} />
    </div>
  );
}
