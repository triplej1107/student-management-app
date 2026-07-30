"use client";

export function BirthdayModal({
  studentName,
  onDismiss,
}: {
  studentName: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <div className="text-4xl">🎂</div>
        <div className="mt-2 text-base font-extrabold text-ink">
          종주T가 {studentName}학생의 생일을 진심으로 축하합니다!
        </div>
        <div className="mt-1.5 text-sm text-ink-secondary">UJC 하나를 선물로 줄게요!</div>

        <button
          onClick={onDismiss}
          className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          고마워요!
        </button>
      </div>
    </div>
  );
}
