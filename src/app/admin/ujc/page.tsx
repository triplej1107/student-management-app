import { requireZongjuSession } from "@/lib/authz";
import { listPendingExchangeRequests } from "@/lib/ujc";
import { EmptyState } from "@/components/ui";
import { UjcGrantForm } from "@/components/admin/UjcGrantForm";
import { UjcExchangeRow } from "@/components/admin/UjcExchangeRow";

export default async function AdminUjcPage() {
  await requireZongjuSession();
  const pending = await listPendingExchangeRequests();

  return (
    <div>
      <div className="mt-4 text-[19px] font-extrabold text-ink">UJC 관리</div>
      <div className="mt-1 text-xs text-ink-muted">유종코인 수동 지급과 교환 승인을 여기서 처리해요.</div>

      <div className="mt-4">
        <UjcGrantForm />
      </div>

      <div className="mt-5">
        <div className="mb-2.5 text-sm font-bold text-ink">교환 승인 대기 · {pending.length}건</div>
        <div className="flex flex-col gap-2.5">
          {pending.length === 0 && <EmptyState>승인 대기 중인 교환 신청이 없어요.</EmptyState>}
          {pending.map((r) => (
            <UjcExchangeRow
              key={r.id}
              requestId={r.id}
              studentName={r.studentName}
              classKey={r.classKey}
              amount={r.amount}
              requestedAt={r.requested_at}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
