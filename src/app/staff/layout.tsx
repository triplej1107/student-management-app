import { requireStaffSession } from "@/lib/authz";
import { BottomTabBar } from "@/components/BottomTabBar";
import { STAFF_TABS } from "@/lib/navTabs";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireStaffSession();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <BottomTabBar tabs={STAFF_TABS} />
    </div>
  );
}
