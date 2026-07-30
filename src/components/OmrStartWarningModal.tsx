"use client";

export function OmrStartWarningModal({
  label,
  onCancel,
  onStart,
}: {
  label: string;
  onCancel: () => void;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <div className="text-base font-extrabold text-ink">⚠️ {label} 응시 안내</div>
        <div className="mt-2 text-sm leading-relaxed text-ink-secondary">
          시험을 시작하면 <b>제출하기 전까지 이 화면을 벗어날 수 없어요.</b> 화면을 벗어나면(다른
          앱 전환, 화면 잠금 등) 그 시점까지 마킹한 답안으로 즉시 제출돼요.
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line bg-white py-2.5 text-sm font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            취소
          </button>
          <button
            onClick={onStart}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            확인, 시작할게요
          </button>
        </div>
      </div>
    </div>
  );
}
