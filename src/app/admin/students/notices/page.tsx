import { requireZongjuSession } from "@/lib/authz";
import { listNoticesForClass } from "@/lib/data";
import { CLASSES, NOTICE_AUDIENCES, type ClassKey } from "@/lib/types";
import { AdminGroupedSubNav } from "@/components/admin/AdminTopNav";
import { PillLink } from "@/components/ui";
import { NoticeEditorRow } from "@/components/admin/NoticeEditorRow";
import { addNoticeAction } from "./actions";
import { STUDENT_TAB_GROUPS } from "../subTabs";

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
      <AdminGroupedSubNav groups={STUDENT_TAB_GROUPS} />

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
        {/* 누구에게 보낼 공지인지 고르면서 바로 추가한다 — 반을 고른 다음
            대상을 고르는 순서가 원장님이 쓰는 순서다. */}
        <div className="rounded-[10px] border border-dashed border-ink-secondary/60 p-2.5">
          <div className="mb-2 text-center text-[11px] font-bold text-ink-muted">
            + 공지 추가 · 누구에게 보낼까요?
          </div>
          <div className="flex gap-1.5">
            {NOTICE_AUDIENCES.map((a) => (
              <form key={a.value} action={addNoticeAction.bind(null, classKey, a.value)} className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-lg border border-line bg-white py-2 text-[12px] font-bold text-ink-secondary shadow-[0_1px_4px_rgba(20,30,60,0.10)]"
                >
                  {a.label}
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
