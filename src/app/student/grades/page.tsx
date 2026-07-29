import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById, getSchoolExams, getMockExams, getClinicTestPercentileTrend } from "@/lib/data";
import { SCHOOL_EXAMS, MOCK_EXAMS } from "@/lib/types";
import { rollingClinicWeeks } from "@/lib/weeks";
import { ScreenTitle } from "@/components/ui";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";

export default async function StudentGradesPage() {
  const session = await requireStudentSession();
  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const clinicWeeks = rollingClinicWeeks(8).slice().reverse(); // 과거 → 최근 순으로 표시

  const [schoolExams, mockExams, clinicPercentile] = await Promise.all([
    getSchoolExams(student.id),
    getMockExams(student.id),
    getClinicTestPercentileTrend(student.id, clinicWeeks),
  ]);

  const latestClinicPoint = [...clinicPercentile].reverse().find((p) => p.topPercent !== null) ?? null;

  const schoolPoints: TrendPoint[] = SCHOOL_EXAMS.map(({ key, label }) => {
    const rec = schoolExams.get(key);
    return { label, value: rec?.rank ?? null, grade: rec?.grade ?? null, note: rec?.note ?? null };
  });

  const mockPoints: TrendPoint[] = MOCK_EXAMS.map(({ key, label }) => {
    const rec = mockExams.get(key);
    return { label, value: rec?.percentile ?? null, grade: rec?.grade ?? null, note: rec?.note ?? null };
  });

  return (
    <div className="box-border px-5 pt-2 pb-7">
      <ScreenTitle>성적</ScreenTitle>

      <div className="mt-4 rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="mb-1 text-sm font-bold text-ink">내신 학교등수 변화</div>
        <div className="mb-2 text-xs text-ink-muted">등수는 낮을수록(위쪽일수록) 좋아요</div>
        <TrendChart points={schoolPoints} higherIsBetter={false} unit="등" />
      </div>

      <div className="mt-3.5 rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="mb-1 text-sm font-bold text-ink">모의고사 백분위 변화</div>
        <div className="mb-2 text-xs text-ink-muted">백분위는 높을수록(위쪽일수록) 좋아요</div>
        <TrendChart points={mockPoints} higherIsBetter={true} unit="%" />
      </div>

      <div className="mt-3.5 rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="mb-1 text-sm font-bold text-ink">클리닉 테스트 백분위 변화</div>
        <div className="mb-2 text-xs text-ink-muted">같은 반 안에서의 상대적 위치예요 (탭하면 정확한 등수를 볼 수 있어요)</div>
        {latestClinicPoint && (
          <div className="mb-2 text-2xl font-extrabold text-accent">
            현재 상위 {latestClinicPoint.topPercent}%
          </div>
        )}
        <TrendChart
          points={clinicPercentile}
          higherIsBetter={true}
          unit="%"
          yDomain={[0, 100]}
          bands={[
            { from: 90, to: 100, opacity: 0.16 },
            { from: 75, to: 90, opacity: 0.1 },
            { from: 50, to: 75, opacity: 0.05 },
          ]}
        />
      </div>
    </div>
  );
}
