import { requireStudentSession } from "@/lib/authz";
import { BottomTabBar, STUDENT_TABS } from "@/components/BottomTabBar";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireStudentSession();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <BottomTabBar tabs={STUDENT_TABS} />
    </div>
  );
}
