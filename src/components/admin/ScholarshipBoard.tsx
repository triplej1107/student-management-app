"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { REFERRAL_STATE_LABEL, type ReferralState } from "@/lib/scholarshipRules";
import type {
  GradeGroup,
  GradeRow,
  GradeScholarshipData,
  PaidEntry,
  ReferralRow,
} from "@/lib/scholarships";
import { setScholarshipCheckAction } from "@/app/admin/students/scholarships/actions";

function manwon(amount: number) {
  return `${amount / 10000}만원`;
}

function dateLabel(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function monthLabel(iso: string) {
  const [y, m] = iso.split("-");
  return `${y}년 ${Number(m)}월`;
}

/** 체크박스처럼 보이는 토글 — 손가락으로 누르기 쉽게 라벨까지 통째로 버튼. */
function CheckToggle({
  checked,
  label,
  onToggle,
  disabled,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={
        "flex flex-none items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold disabled:opacity-50 " +
        (checked
          ? "border-success bg-success-soft text-success"
          : "border-line bg-white text-ink-muted")
      }
    >
      <span className="text-[13px] leading-none">{checked ? "☑" : "☐"}</span>
      {label}
    </button>
  );
}

const STATE_BADGE: Record<ReferralState, string> = {
  due: "bg-accent text-white",
  waiting: "bg-line-soft text-ink-muted",
  paid: "bg-success-soft text-success",
  void: "bg-line-soft text-ink-muted line-through",
  unknown: "bg-warn-soft text-warn",
};

export function ScholarshipBoard({
  referrals,
  gradeData,
}: {
  referrals: ReferralRow[];
  gradeData: GradeScholarshipData;
}) {
  const [tab, setTab] = useState<"referral" | "grade">("referral");
  const [showHistory, setShowHistory] = useState(false);

  const dueCount = referrals.filter((r) => r.state === "due").length;
  const gradeUnpaid = gradeData.groups.reduce((n, g) => n + g.rows.length, 0);

  // 지급 완료한 건 목록에서 빼고 여기로 모은다.
  const history: PaidEntry[] = [
    ...referrals
      .filter((r) => r.state === "paid")
      .map((r) => ({
        kind: "referral" as const,
        refKey: r.refKey,
        context: "친구 소개",
        name: r.referrer?.name ?? r.referrerName ?? "미상",
        reason: `${r.referred.name} 소개`,
        amount: r.amount,
      })),
    ...gradeData.paid,
  ];

  if (showHistory) {
    return <HistoryPanel entries={history} onClose={() => setShowHistory(false)} />;
  }

  return (
    <div>
      <div className="mt-3.5 flex justify-end">
        <button
          onClick={() => setShowHistory(true)}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-[11px] font-bold text-ink-secondary shadow-[0_1px_4px_rgba(20,30,60,0.10)]"
        >
          지급 내역 {history.length > 0 && `(${history.length})`}
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        {(
          [
            ["referral", "친구 소개", dueCount],
            ["grade", "성적 (1등급)", gradeUnpaid],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={
              "flex-1 rounded-xl border px-3 py-2 text-[13px] font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
              (tab === key
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-white text-ink-secondary")
            }
          >
            {label}
            {count > 0 && (
              <span className="ml-1 rounded-full bg-danger px-1.5 py-0.5 text-[10px] text-white">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "referral" ? (
        <ReferralSection rows={referrals} />
      ) : (
        <GradeSection groups={gradeData.groups} />
      )}
    </div>
  );
}

// ============================================================
// 지급 내역 — 언제 누구에게 왜 얼마 줬는지만 한 줄씩.
// ============================================================

function HistoryPanel({ entries, onClose }: { entries: PaidEntry[]; onClose: () => void }) {
  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="mt-3.5 flex items-center justify-between">
        <div className="text-[15px] font-extrabold text-ink">지급 내역</div>
        <button
          onClick={onClose}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-[11px] font-bold text-ink-secondary shadow-[0_1px_4px_rgba(20,30,60,0.10)]"
        >
          목록으로
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-line-soft bg-white p-5 text-center text-[13px] text-ink-muted/70">
          아직 지급한 장학금이 없어요.
        </div>
      ) : (
        <>
          <div className="mt-1 text-[11px] text-ink-muted">
            모두 {entries.length}건 · 합계 {total.toLocaleString()}원
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {entries.map((e) => (
              <HistoryRow key={`${e.kind}_${e.refKey}`} entry={e} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HistoryRow({ entry }: { entry: PaidEntry }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  function undo() {
    if (!confirm(`${entry.name} 지급 완료를 취소하고 목록으로 되돌릴까요?`)) return;
    startTransition(async () => {
      await setScholarshipCheckAction(entry.kind, entry.refKey, "paid", false);
      showToast("목록으로 되돌렸어요");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-line-soft bg-white px-3 py-2">
      <div className="min-w-0 text-[13px] text-ink">
        <span className="text-[11px] text-ink-muted">{entry.context}</span>
        <span className="ml-1.5 font-bold">{entry.name}</span>
        <span className="ml-1 text-[11px] text-ink-muted">{entry.reason}</span>
      </div>
      <div className="flex flex-none items-center gap-1.5">
        <span className="text-[13px] font-extrabold text-accent">{manwon(entry.amount)}</span>
        <button
          onClick={undo}
          disabled={pending}
          className="rounded-md border border-line px-1.5 py-1 text-[10px] font-bold text-ink-muted disabled:opacity-50"
        >
          되돌리기
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 친구 소개 장학금
// ============================================================

function ReferralSection({ rows }: { rows: ReferralRow[] }) {
  const buckets: { state: ReferralState; title: string; hint?: string }[] = [
    { state: "due", title: "지금 줘야 할 것", hint: "두 달 연속 다닌 게 확인됐어요." },
    {
      state: "unknown",
      title: "확인 필요",
      hint: "소개한 학생을 못 찾았거나 첫수업일이 비어 있어요. 명단에서 채워주면 자동으로 넘어가요.",
    },
    { state: "waiting", title: "기다리는 중", hint: "둘째 달이 시작되면 지급 대상으로 올라와요." },
    { state: "void", title: "무효", hint: "두 달을 못 채우고 그만둔 경우예요." },
  ];

  // 지급 완료한 건 "지급 내역"으로 빠져서 여기 남는 게 없을 수도 있다.
  if (rows.every((r) => r.state === "paid")) {
    return (
      <div className="mt-4 rounded-2xl border border-line-soft bg-white p-5 text-center text-[13px] text-ink-muted/70">
        {rows.length === 0 ? "소개로 온 학생이 아직 없어요." : "챙길 소개 장학금이 없어요."}
        <div className="mt-1 text-[11px]">
          회원명단 엑셀 [메모] 칸에 &ldquo;OOO 소개&rdquo;라고 써두면 여기에 자동으로 올라와요.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {buckets.map(({ state, title, hint }) => {
        const bucket = rows.filter((r) => r.state === state);
        if (bucket.length === 0) return null;
        return (
          <div key={state} className="mb-5">
            <div className="mb-1 text-[13px] font-extrabold text-ink">
              {title} <span className="font-normal text-ink-muted">({bucket.length}건)</span>
            </div>
            {hint && <div className="mb-2 text-[11px] text-ink-muted">{hint}</div>}
            <div className="flex flex-col gap-2">
              {bucket.map((row) => (
                <ReferralRowCard key={row.refKey} row={row} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReferralRowCard({ row }: { row: ReferralRow }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  function togglePaid() {
    const next = !(row.state === "paid");
    startTransition(async () => {
      await setScholarshipCheckAction("referral", row.refKey, "paid", next);
      showToast(next ? "지급 완료로 체크했어요" : "지급 완료를 해제했어요");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-ink">
            {row.referrer ? (
              <>
                {row.referrer.name}
                <span className="ml-1 text-xs font-normal text-ink-muted">
                  {row.referrer.student_code}
                </span>
              </>
            ) : (
              <span className="text-warn">
                {row.referrerName ?? "소개자 미상"}
                {row.ambiguous ? " (동명이인)" : " (명단에 없음)"}
              </span>
            )}
            <span className="ml-1.5 text-[13px] font-extrabold text-accent">
              {manwon(row.amount)}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-ink-muted">
            {row.referred.name}
            <span className="ml-1">{row.referred.student_code}</span> 소개
          </div>
          <div className="mt-0.5 text-[11px] text-ink-muted">
            {row.firstLessonISO ? (
              <>
                첫수업 {dateLabel(row.firstLessonISO)} · 지급 시점{" "}
                <b className="text-ink-secondary">{monthLabel(row.dueFromISO!)}</b>
              </>
            ) : (
              <span className="text-warn">첫수업일이 비어 있어요</span>
            )}
          </div>
        </div>
        <span
          className={`flex-none rounded-full px-2 py-1 text-[11px] font-bold ${STATE_BADGE[row.state]}`}
        >
          {REFERRAL_STATE_LABEL[row.state]}
        </span>
      </div>

      {row.state !== "unknown" && row.state !== "void" && (
        <div className="mt-2 flex justify-end">
          <CheckToggle
            checked={row.state === "paid"}
            label="지급 완료"
            onToggle={togglePaid}
            disabled={pending}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// 성적 장학금
// ============================================================

function GradeSection({ groups }: { groups: GradeGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-line-soft bg-white p-5 text-center text-[13px] text-ink-muted/70">
        챙길 성적 장학금이 없어요.
        <div className="mt-1 text-[11px]">
          학년별로 이번 1학기 기말만 봐요. 개별 탭에서 내신 성적(등급·등수)을 넣으면 여기에 자동으로
          올라와요.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-3 rounded-xl bg-accent-soft/50 px-3 py-2 text-[11px] leading-relaxed text-ink-secondary">
        1등급 <b>3만원</b>, 그중 전교 3등 이내면 <b>5만원</b>이에요. 네이버 리뷰를 확인해야 지급
        완료를 누를 수 있어요.
      </div>
      {groups.map((group) => (
        <div key={group.examKey} className="mb-5">
          <div className="mb-2 text-[13px] font-extrabold text-ink">
            {group.label} <span className="font-normal text-ink-muted">({group.rows.length}명)</span>
          </div>
          <div className="flex flex-col gap-2">
            {group.rows.map((row) => (
              <GradeRowCard key={row.refKey} row={row} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function GradeRowCard({ row }: { row: GradeRow }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  function toggle(field: "review_done" | "paid", next: boolean, label: string) {
    startTransition(async () => {
      await setScholarshipCheckAction("grade", row.refKey, field, next);
      showToast(next ? `${label} 체크했어요` : `${label} 해제했어요`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-ink">
            {row.student.name}
            <span className="ml-1 text-xs font-normal text-ink-muted">
              {row.student.student_code}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-ink-muted">
            1등급{row.rank !== null && ` · 전교 ${row.rank}등`}
          </div>
        </div>
        <span
          className={
            "flex-none rounded-full px-2 py-1 text-[11px] font-extrabold " +
            (row.amount > 30000 ? "bg-accent text-white" : "bg-accent-soft text-accent")
          }
        >
          {manwon(row.amount)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        {!row.reviewDone && (
          <span className="mr-auto text-[10px] text-ink-muted/80">리뷰 확인 후 지급</span>
        )}
        <CheckToggle
          checked={row.reviewDone}
          label="네이버 리뷰"
          onToggle={() => toggle("review_done", !row.reviewDone, "네이버 리뷰를")}
          disabled={pending}
        />
        {/* 리뷰를 안 썼는데 먼저 줘버리는 걸 막는다 — 리뷰가 조건인 장학금이라
            순서가 뒤집히면 되돌릴 수가 없다. */}
        <CheckToggle
          checked={false}
          label="지급 완료"
          onToggle={() => toggle("paid", true, "지급 완료를")}
          disabled={pending || !row.reviewDone}
        />
      </div>
    </div>
  );
}
