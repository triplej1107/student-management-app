import { requireStaffSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import { toISODate } from "@/lib/weeks";
import { getDutyChecksForStaffDate, listDutyItems } from "@/lib/data";
import { ScreenTitle } from "@/components/ui";
import { DutyChecklist } from "@/components/staff/DutyChecklist";

export default async function StaffChecklistPage() {
  const session = await requireStaffSession();
  const { today } = getToday();
  const items = await listDutyItems();
  const checksMap = await getDutyChecksForStaffDate(session.staffId, today);
  const initialChecked = Object.fromEntries(
    items.map((i) => [i.id, checksMap.get(i.id) ?? false])
  );
  const doneCount = items.filter((i) => checksMap.get(i.id)).length;

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <ScreenTitle>업무 체크리스트</ScreenTitle>
      <div className="mt-1.5 text-[13px] font-bold text-ink-muted">
        {doneCount}/{items.length}
      </div>
      <DutyChecklist items={items} initialChecked={initialChecked} dateISO={toISODate(today)} />
    </div>
  );
}
