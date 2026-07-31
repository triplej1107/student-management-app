"use client";

import { useState, useTransition } from "react";
import { NEW_STUDENT_CHECKLIST, type NewStudentOnboarding } from "@/lib/types";
import { toggleOnboardingCheckAction } from "@/app/newStudentActions";

function subtitle(o: NewStudentOnboarding): string {
  return [o.school, o.grade ? `${o.grade}학년` : null].filter(Boolean).join(" ");
}

/** 조교·종주T 홈 화면에 뜨는 신규 학생 챙기기 체크리스트. 6개를 전부
 * 체크해야 목록에서 사라진다 — 신규가 왔는데 챙길 걸 빠뜨리는 일을 막는
 * 게 목적이라 일부러 계속 눈에 띄게 남겨둔다. */
export function NewStudentChecklist({ onboardings }: { onboardings: NewStudentOnboarding[] }) {
  if (onboardings.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="mb-2.5 text-sm font-bold text-ink">
        🆕 신규 학생 챙기기{" "}
        <span className="font-normal text-ink-muted">({onboardings.length}명)</span>
      </div>
      <div className="flex flex-col gap-2">
        {onboardings.map((o) => (
          <OnboardingCard key={o.id} onboarding={o} />
        ))}
      </div>
    </div>
  );
}

function OnboardingCard({ onboarding }: { onboarding: NewStudentOnboarding }) {
  const [checks, setChecks] = useState(onboarding.checks);
  const [, startTransition] = useTransition();
  const doneCount = checks.filter(Boolean).length;
  const info = subtitle(onboarding);

  function toggle(index: number) {
    const next = [...checks];
    next[index] = !next[index];
    setChecks(next);
    startTransition(async () => {
      await toggleOnboardingCheckAction(onboarding.id, index, next[index]);
    });
  }

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent-soft/40 p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[15px] font-bold text-ink">
          {onboarding.name}
          {info && <span className="ml-1 text-xs font-normal text-ink-muted">{info}</span>}
        </div>
        <span className="flex-none rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-accent">
          {doneCount}/{NEW_STUDENT_CHECKLIST.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {NEW_STUDENT_CHECKLIST.map((label, i) => (
          <label
            key={label}
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-[13px]"
          >
            <input
              type="checkbox"
              checked={checks[i] ?? false}
              onChange={() => toggle(i)}
              className="h-4 w-4 flex-none"
            />
            <span className={checks[i] ? "text-ink-muted line-through" : "text-ink"}>
              {i + 1}. {label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
