import { requireZongjuSession } from "@/lib/authz";
import { listDutyItems } from "@/lib/data";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { DutyItemEditor } from "@/components/admin/DutyItemEditor";
import { addDutyItemAction } from "./actions";
import { STAFF_SUB_TABS } from "../subTabs";

export default async function AdminDutyPage() {
  await requireZongjuSession();
  const items = await listDutyItems();

  return (
    <div>
      <AdminSubNav tabs={STAFF_SUB_TABS} />

      <div className="mt-3.5 flex flex-col gap-2">
        {items.map((item) => (
          <DutyItemEditor key={item.id} item={item} />
        ))}
        <form action={addDutyItemAction}>
          <button
            type="submit"
            className="w-full rounded-[10px] border border-dashed border-ink-secondary/60 py-3 text-[13px] font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            + 항목 추가
          </button>
        </form>
      </div>
    </div>
  );
}
