import { requireZongjuSession } from "@/lib/authz";
import { listStaff } from "@/lib/data";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { StaffProfileCard } from "@/components/admin/StaffProfileCard";
import { addStaffProfileAction } from "./actions";

export default async function AdminStaffProfilesPage() {
  await requireZongjuSession();
  const staff = await listStaff();

  return (
    <div>
      <AdminSubNav
        tabs={[
          { href: "/admin/staff/profiles", label: "조교 프로필" },
          { href: "/admin/staff/duty", label: "요일별 체크리스트" },
        ]}
      />

      <div className="mt-3.5 flex flex-col gap-3">
        {staff.map((s) => (
          <StaffProfileCard key={s.id} staff={s} />
        ))}
        <form action={addStaffProfileAction}>
          <button
            type="submit"
            className="w-full rounded-[10px] border border-dashed border-ink-secondary/60 py-3 text-[13px] font-bold text-ink-secondary"
          >
            + 조교 추가
          </button>
        </form>
      </div>
    </div>
  );
}
