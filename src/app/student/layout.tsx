import { requireStudentSession } from "@/lib/authz";
import { BottomTabBar } from "@/components/BottomTabBar";
import { STUDENT_TABS } from "@/lib/navTabs";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStudentSession();
  // 학부모는 UJC를 쓰지 않으니 탭 라벨만 "유종의미"로 바꿔 보여준다
  // (아이콘/팝업 스타일은 icon 필드로 유지되므로 그대로 적용됨).
  const tabs =
    session.role === "parent"
      ? STUDENT_TABS.map((t) => (t.icon === "UJC" ? { ...t, label: "유종의미" } : t))
      : STUDENT_TABS;
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">{children}</div>
      <BottomTabBar tabs={tabs} />
    </div>
  );
}
