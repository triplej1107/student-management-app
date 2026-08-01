import "server-only";
import { getSchoolExams, getMockExams, getClinicTestPercentileTrend } from "./data";
import { rollingClinicWeeks } from "./weeks";
import { SCHOOL_EXAMS, MOCK_EXAMS, type ClinicPercentilePoint } from "./types";
import type { TrendPoint } from "@/components/TrendChart";

export interface StudentGradeTrends {
  clinicPercentile: ClinicPercentilePoint[];
  schoolPoints: TrendPoint[];
  mockPoints: TrendPoint[];
  /** 가장 최근에 값이 있는 클리닉 백분위 — "현재 상위 N%" 문구용. */
  latestTopPercent: number | null;
}

/** 학생 성적 화면의 그래프 3종 데이터. 학생 본인 화면과 종주T 개별 관리
 * 화면이 같은 그래프를 보여주므로 계산을 한곳에 모아둔다 — 따로 두면
 * "종합 제외" 같은 규칙이 한쪽에만 반영되어 서로 달라진다. */
export async function getStudentGradeTrends(studentId: number): Promise<StudentGradeTrends> {
  const clinicWeeks = rollingClinicWeeks(8).slice().reverse(); // 과거 → 최근 순으로 표시

  const [schoolExams, mockExams, clinicPercentile] = await Promise.all([
    getSchoolExams(studentId),
    getMockExams(studentId),
    getClinicTestPercentileTrend(studentId, clinicWeeks),
  ]);

  const latest = [...clinicPercentile].reverse().find((p) => p.topPercent !== null) ?? null;

  // "종합"은 그 학기 중간+기말을 합산한 값일 뿐 별개의 시험이 아니라서
  // 등수 변화 그래프에서는 제외 — 안 그러면 같은 학기가 두 번(중간/기말 +
  // 종합) 잡혀서 추세가 왜곡된다.
  const schoolPoints: TrendPoint[] = SCHOOL_EXAMS.filter(
    (e) => !("scoreless" in e && e.scoreless)
  ).map(({ key, label }) => {
    const rec = schoolExams.get(key);
    return { label, value: rec?.rank ?? null, grade: rec?.grade ?? null, note: rec?.note ?? null };
  });

  const mockPoints: TrendPoint[] = MOCK_EXAMS.map(({ key, label }) => {
    const rec = mockExams.get(key);
    return { label, value: rec?.percentile ?? null, grade: rec?.grade ?? null, note: rec?.note ?? null };
  });

  return { clinicPercentile, schoolPoints, mockPoints, latestTopPercent: latest?.topPercent ?? null };
}
