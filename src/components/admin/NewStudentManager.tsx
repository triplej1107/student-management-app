"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { NEW_STUDENT_CHECKLIST, type NewStudentOnboarding } from "@/lib/types";
import {
  createOnboardingAction,
  deleteOnboardingAction,
} from "@/app/admin/staff/new-students/actions";

export function NewStudentManager({ onboardings }: { onboardings: NewStudentOnboarding[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createOnboardingAction(name, school, grade);
        setName("");
        setSchool("");
        setGrade("");
        showToast("신규 학생이 추가됐어요");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "추가하지 못했어요.");
      }
    });
  }

  function remove(id: number, studentName: string) {
    if (!confirm(`${studentName} 학생을 목록에서 지울까요?`)) return;
    startTransition(async () => {
      await deleteOnboardingAction(id);
      showToast("삭제됐어요");
      router.refresh();
    });
  }

  const open = onboardings.filter((o) => !o.completed_at);
  const done = onboardings.filter((o) => o.completed_at);

  return (
    <div>
      <div className="rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="mb-2 text-sm font-extrabold text-ink">새 신규 학생</div>
        <div className="mb-1.5 flex gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름 (필수)"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
          <input
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="학교"
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="학년"
            className="w-16 flex-none rounded-lg border border-line px-2.5 py-2 text-xs"
          />
        </div>
        {error && <div className="mt-1.5 text-[11px] font-semibold text-danger">{error}</div>}
        <button
          onClick={submit}
          disabled={pending || !name.trim()}
          className="mt-1.5 w-full rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
        >
          {pending ? "추가 중..." : "추가"}
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[13px] font-bold text-ink">
          챙기는 중 <span className="font-normal text-ink-muted">({open.length}명)</span>
        </div>
        {open.length === 0 && (
          <div className="text-[13px] text-ink-muted/70">챙기는 중인 신규 학생이 없어요.</div>
        )}
        <div className="flex flex-col gap-2">
          {open.map((o) => (
            <Row key={o.id} onboarding={o} onDelete={() => remove(o.id, o.name)} />
          ))}
        </div>
      </div>

      {done.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[13px] font-bold text-ink-muted">
            완료 <span className="font-normal">({done.length}명)</span>
          </div>
          <div className="flex flex-col gap-2">
            {done.map((o) => (
              <Row key={o.id} onboarding={o} onDelete={() => remove(o.id, o.name)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  onboarding,
  onDelete,
}: {
  onboarding: NewStudentOnboarding;
  onDelete: () => void;
}) {
  const doneCount = onboarding.checks.filter(Boolean).length;
  const complete = !!onboarding.completed_at;
  const info = [onboarding.school, onboarding.grade ? `${onboarding.grade}학년` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-line-soft bg-white p-3">
      <div className="min-w-0">
        <div className="text-[13px] font-bold text-ink">
          {onboarding.name}
          {info && <span className="ml-1 text-xs font-normal text-ink-muted">{info}</span>}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-muted">
          {complete ? "6개 항목 모두 완료" : `${doneCount}/${NEW_STUDENT_CHECKLIST.length} 완료 · 조교 홈 화면에 표시 중`}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="flex-none rounded-lg border border-danger-soft bg-danger-soft px-2.5 py-1.5 text-[11px] font-bold text-danger"
      >
        삭제
      </button>
    </div>
  );
}
