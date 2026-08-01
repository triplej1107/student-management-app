"use client";

import { useEffect, useState } from "react";
import { StudentGradeCharts } from "@/components/StudentGradeCharts";
import { getStudentGradeTrendsAction } from "@/app/admin/students/individual/actions";
import type { StudentGradeTrends } from "@/lib/gradeTrends";

/** 개별 관리 화면 맨 아래 — 학생이 자기 성적 화면에서 보는 것과 똑같은
 * 그래프. 학생을 고를 때마다 불러오므로, 성적을 입력한 뒤 바로 추세가
 * 어떻게 바뀌는지 확인할 수 있다. */
export function StudentGradeTrendPanel({ studentId }: { studentId: number }) {
  const [trends, setTrends] = useState<StudentGradeTrends | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTrends(null);
    setFailed(false);
    getStudentGradeTrendsAction(studentId)
      .then((t) => {
        if (!cancelled) setTrends(t);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <div className="mb-2 text-[11px] font-bold text-ink-muted">
        성적 변화 (학생 화면과 동일)
      </div>
      {failed ? (
        <div className="text-[11px] text-danger">그래프를 불러오지 못했어요.</div>
      ) : !trends ? (
        <div className="text-[11px] text-ink-muted/70">불러오는 중...</div>
      ) : (
        <StudentGradeCharts {...trends} compact />
      )}
    </div>
  );
}
