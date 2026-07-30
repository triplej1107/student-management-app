import { requireZongjuSession } from "@/lib/authz";
import { listPendingExchangeRequests } from "@/lib/ujc";
import { listAllUjcMarketItems } from "@/lib/ujcMarket";
import { EmptyState } from "@/components/ui";
import { UjcGrantForm } from "@/components/admin/UjcGrantForm";
import { UjcExchangeRow } from "@/components/admin/UjcExchangeRow";
import { UjcMarketManager } from "@/components/admin/UjcMarketManager";

export default async function AdminUjcPage() {
  await requireZongjuSession();
  const [pending, marketItems] = await Promise.all([
    listPendingExchangeRequests(),
    listAllUjcMarketItems(),
  ]);

  return (
    <div>
      <div className="mt-4 text-[19px] font-extrabold text-ink">UJC 관리</div>
      <div className="mt-1 text-xs text-ink-muted">
        유종코인 수동 지급과 UJC마켓 교환 신청(카카오톡 선물 발송 대기)을 여기서 처리해요.
      </div>

      <div className="mt-4">
        <UjcGrantForm />
      </div>

      <div className="mt-5">
        <div className="mb-2.5 text-sm font-bold text-ink">발송 대기 · {pending.length}건</div>
        <div className="flex flex-col gap-2.5">
          {pending.length === 0 && <EmptyState>발송 대기 중인 교환 신청이 없어요.</EmptyState>}
          {pending.map((r) => (
            <UjcExchangeRow
              key={r.id}
              requestId={r.id}
              studentName={r.studentName}
              classKey={r.classKey}
              amount={r.amount}
              brandName={r.brand_name}
              priceValue={r.price_value}
              requestedAt={r.requested_at}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2.5 text-sm font-bold text-ink">UJC 마켓 관리</div>
        <div className="mb-2.5 text-xs text-ink-muted">
          품목별 가격을 바꾸거나, 브랜드를 교체하거나, 잠깐 숨기거나(발송 준비 안 됐을 때) 삭제할 수 있어요.
          가격/브랜드 변경은 입력 즉시 저장돼요.
        </div>
        <UjcMarketManager items={marketItems} />
      </div>
    </div>
  );
}
