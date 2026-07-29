import { requireZongjuSession } from "@/lib/authz";
import { MonthlyReportSender } from "@/components/admin/MonthlyReportSender";

export default async function AdminReportsPage() {
  await requireZongjuSession();

  return (
    <div>
      <div className="mt-4 text-[19px] font-extrabold text-ink">보고서</div>
      <div className="mt-1 text-xs text-ink-muted">
        앱 안의 기록은 계속 데이터베이스에 남아있지만, 별도로 엑셀 백업이 필요하실 때 여기서 받으세요.
      </div>

      <div className="mt-4">
        <MonthlyReportSender recipientEmail={process.env.REPORT_RECIPIENT_EMAIL ?? null} />
      </div>
    </div>
  );
}
