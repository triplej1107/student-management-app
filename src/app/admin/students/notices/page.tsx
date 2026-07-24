import { requireZongjuSession } from "@/lib/authz";
import { listNoticesForClass } from "@/lib/data";
import { CLASSES, type ClassKey } from "@/lib/types";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { PillLink } from "@/components/ui";
import { NoticeEditorRow } from "@/components/admin/NoticeEditorRow";
import { addNoticeAction } from "./actions";
import { STUDENT_SUB_TABS } from "../subTabs";

export default async function AdminNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  await requireZongjuSession();
  const { class: classParam } = await searchParams;
  const classKey: ClassKey = CLASSES.includes(classParam as ClassKey)
    ? (classParam as ClassKey)
    : CLASSES[0];

  const notices = await listNoticesForClass(classKey);

  return (
    <div>
      <AdminSubNav tabs={STUDENT_SUB_TABS} />

      <div className="mt-4 flex flex-wrap gap-2">
        {CLASSES.map((c) => (
          <PillLink key={c} href={`/admin/students/notices?class=${c}`} active={c === classKey}>
            {c}
          </PillLink>
        ))}
      </div>

      <div className="mt-3.5 flex flex-col gap-2.5">
        {notices.map((n) => (
          <NoticeEditorRow key={n.id} notice={n} />
        ))}
        <form action={addNoticeAction.bind(null, classKey)}>
          <button
            type="submit"
            className="w-full rounded-[10px] border border-dashed border-ink-secondary/60 py-3 text-[13px] font-bold text-ink-secondary"
          >
            + 공지 추가
          </button>
        </form>
      </div>
    </div>
  );
}
