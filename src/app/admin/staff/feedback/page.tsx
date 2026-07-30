import { requireZongjuSession } from "@/lib/authz";
import { listStaff } from "@/lib/data";
import { listStaffFeedbackHistory } from "@/lib/staffFeedback";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { StaffFeedbackSender } from "@/components/admin/StaffFeedbackSender";
import { STAFF_SUB_TABS } from "../subTabs";
import { sendStaffFeedbackAction } from "./actions";

export default async function AdminStaffFeedbackPage() {
  await requireZongjuSession();
  const staff = await listStaff();
  const histories = await Promise.all(staff.map((s) => listStaffFeedbackHistory(s.id)));

  return (
    <div>
      <AdminSubNav tabs={STAFF_SUB_TABS} />

      <div className="mt-4 text-[19px] font-extrabold text-ink">조교 피드백</div>
      <div className="mt-1 text-xs text-ink-muted">
        조교에게 한마디를 남기면 웹 푸시와 조교 화면 알림창으로 바로 전달돼요.
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {staff.map((s, i) => (
          <StaffFeedbackSender
            key={s.id}
            staffId={s.id}
            staffName={s.name}
            history={histories[i]}
            sendAction={sendStaffFeedbackAction}
          />
        ))}
      </div>
    </div>
  );
}
