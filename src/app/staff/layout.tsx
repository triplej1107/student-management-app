import { requireStaffSession } from "@/lib/authz";
import { BottomTabBar, STAFF_TABS } from "@/components/BottomTabBar";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireStaffSession();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <BottomTabBar tabs={STAFF_TABS} />
    </div>
  );
}
