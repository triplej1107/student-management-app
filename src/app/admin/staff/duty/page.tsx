import { requireZongjuSession } from "@/lib/authz";
import { listDutyItems } from "@/lib/data";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { DutyItemEditor } from "@/components/admin/DutyItemEditor";
import { addDutyItemAction } from "./actions";

export default async function AdminDutyPage() {
  await requireZongjuSession();
  const items = await listDutyItems();

  return (
    <div>
      <AdminSubNav
        tabs={[
          { href: "/admin/staff/profiles", label: "조교 프로필" },
          { href: "/admin/staff/duty", label: "요일별 체크리스트" },
        ]}
      />

      <div className="mt-3.5 flex flex-col gap-2">
        {items.map((item) => (
          <DutyItemEditor key={item.id} item={item} />
        ))}
        <form action={addDutyItemAction}>
          <button
            type="submit"
            className="w-full rounded-[10px] border border-dashed border-ink-secondary/60 py-3 text-[13px] font-bold text-ink-secondary"
          >
            + 항목 추가
          </button>
        </form>
      </div>
    </div>
  );
}
