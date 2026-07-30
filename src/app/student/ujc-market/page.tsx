import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById } from "@/lib/data";
import { getUjcBalance, getMyExchangeRequests } from "@/lib/ujc";
import { listActiveUjcMarketItems } from "@/lib/ujcMarket";
import { UJC_EXCHANGE_UNITS } from "@/lib/types";
import { EmptyState } from "@/components/ui";
import { UjcMarketItemCard } from "@/components/UjcMarketItemCard";

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "발송 대기", className: "bg-warn-soft text-warn" },
  approved: { text: "발송 완료", className: "bg-success-soft text-success" },
  rejected: { text: "취소됨(환불)", className: "bg-line-soft text-ink-muted" },
};

export default async function UjcMarketPage() {
  const session = await requireStudentSession();
  if (session.role !== "student") notFound(); // 학부모는 UJC 완전 비공개

  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const [balance, myRequests, marketItems] = await Promise.all([
    getUjcBalance(student.id),
    getMyExchangeRequests(student.id, 10),
    listActiveUjcMarketItems(),
  ]);

  return (
    <div className="box-border pb-7">
      <div className="sticky top-0 z-10 border-b border-line bg-white px-5 pb-3 pt-3">
        <Link href="/student" className="inline-block px-0 py-1 text-[20px] leading-none text-ink">
          ‹
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <div className="text-lg font-extrabold text-ink">UJC 마켓</div>
          <div className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-extrabold text-accent">
            보유 {balance} UJC
          </div>
        </div>
      </div>

      <div className="px-5 pt-4">
        {UJC_EXCHANGE_UNITS.map((tier) => (
          <div key={tier} className="mt-2 mb-5">
            <div className="mb-2 text-sm font-bold text-ink">{tier} UJC 교환 상품</div>
            <div className="flex flex-col gap-2">
              {marketItems.filter((item) => item.tier === tier).map((item) => (
                <UjcMarketItemCard key={item.id} item={item} balance={balance} />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-6">
          <div className="mb-2 text-sm font-bold text-ink">내 신청 내역</div>
          <div className="flex flex-col gap-2">
            {myRequests.length === 0 && <EmptyState>아직 신청한 교환이 없어요.</EmptyState>}
            {myRequests.map((r) => {
              const status = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-2xl border border-line-soft bg-white p-3"
                >
                  <div>
                    <div className="text-sm font-bold text-ink">
                      {r.brand_name} {r.price_value?.toLocaleString()}원권
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      {r.amount} UJC · {new Date(r.requested_at).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                  <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + status.className}>
                    {status.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
