import "server-only";
import {
  listStudents,
  listStudentsByClass,
  getStudentById,
  getClinicTemplatesForWeek,
  getClinicChecksForStudents,
} from "./data";
import { isClinicFullyDone } from "./clinicProgress";
import { rollingClinicWeeks, mondayOf } from "./weeks";
import type { ClassKey, ClinicCheck, ClinicTemplate } from "./types";

export type TierGrade =
  | "그랜드마스터"
  | "마스터"
  | "다이아"
  | "플래티넘"
  | "골드"
  | "실버"
  | "브론즈";

const TIER_BOUNDARIES: { grade: TierGrade; min: number }[] = [
  { grade: "그랜드마스터", min: 90 },
  { grade: "마스터", min: 80 },
  { grade: "다이아", min: 70 },
  { grade: "플래티넘", min: 60 },
  { grade: "골드", min: 50 },
  { grade: "실버", min: 40 },
  { grade: "브론즈", min: -Infinity },
];

export function gradeForScore(score: number): TierGrade {
  return TIER_BOUNDARIES.find((b) => score >= b.min)!.grade;
}

export const TIER_GRADES_DESC: TierGrade[] = TIER_BOUNDARIES.map((b) => b.grade);

export interface StudentTierInfo {
  studentId: number;
  name: string;
  nickname: string | null;
  classKey: ClassKey;
  eligible: boolean; // false = "등급 산정 중" (2주 미만 데이터)
  tierScore: number | null;
  grade: TierGrade | null;
  completionRate: number | null; // 0~100
  avgTestPercentile: number | null; // 0~100
}

/** 같은 주 시험을 본 학생들끼리 등수를 매겨 (밀림 관리/백분위 추이와
 * 동일한 방식) studentId -> percentile(0~100) 맵을 만든다. */
function percentileMapForWeek(
  template: ClinicTemplate | undefined,
  checks: Map<number, ClinicCheck>,
  studentIds: number[]
): Map<number, number> {
  const result = new Map<number, number>();
  if (!template) return result;

  const ranksByStudent = new Map<number, number[]>();
  for (let slot = 0; slot < 4; slot++) {
    const entries: { studentId: number; pct: number }[] = [];
    for (const sid of studentIds) {
      const ts = checks.get(sid)?.test_scores?.[slot];
      const score = ts?.score !== undefined && ts.score !== "" ? Number(ts.score) : NaN;
      const total = ts?.total !== undefined && ts.total !== "" ? Number(ts.total) : NaN;
      if (!Number.isNaN(score) && !Number.isNaN(total) && total > 0) {
        entries.push({ studentId: sid, pct: score / total });
      }
    }
    for (const e of entries) {
      const rank = 1 + entries.filter((o) => o.pct > e.pct).length;
      const list = ranksByStudent.get(e.studentId) ?? [];
      list.push(rank);
      ranksByStudent.set(e.studentId, list);
    }
  }

  const avgRanks = Array.from(ranksByStudent.entries()).map(([sid, ranks]) => ({
    studentId: sid,
    avg: ranks.reduce((a, b) => a + b, 0) / ranks.length,
  }));
  const n = avgRanks.length;
  for (const { studentId, avg } of avgRanks) {
    const rank = 1 + avgRanks.filter((a) => a.avg < avg).length;
    result.set(studentId, n > 1 ? Math.round(((n - rank) / (n - 1)) * 100) : 100);
  }
  return result;
}

function summarizeTier(
  studentId: number,
  classKey: ClassKey,
  createdAt: string,
  weeksAsc: Date[],
  templatesByWeek: Map<ClassKey, ClinicTemplate>[],
  checksByWeek: Map<number, ClinicCheck>[],
  percentileByWeek: Map<number, number>[]
): { eligible: boolean; tierScore: number | null; grade: TierGrade | null; completionRate: number | null; avgTestPercentile: number | null } {
  const trackingSince = mondayOf(new Date(createdAt));

  let applicableWeeks = 0;
  let doneWeeks = 0;
  const percentiles: number[] = [];

  for (let i = 0; i < weeksAsc.length; i++) {
    const week = weeksAsc[i];
    if (week < trackingSince) continue;
    const template = templatesByWeek[i].get(classKey);
    if (!template) continue;
    applicableWeeks++;
    if (isClinicFullyDone(template, checksByWeek[i].get(studentId))) doneWeeks++;
    const pct = percentileByWeek[i].get(studentId);
    if (pct !== undefined) percentiles.push(pct);
  }

  const eligible = applicableWeeks >= 2;
  const completionRate = applicableWeeks > 0 ? (doneWeeks / applicableWeeks) * 100 : null;
  const avgTestPercentile =
    percentiles.length > 0 ? percentiles.reduce((a, b) => a + b, 0) / percentiles.length : null;

  let tierScore: number | null = null;
  let grade: TierGrade | null = null;
  if (eligible && completionRate !== null) {
    tierScore = completionRate * 0.7 + (avgTestPercentile ?? 0) * 0.3;
    grade = gradeForScore(tierScore);
  }

  return { eligible, tierScore, grade, completionRate, avgTestPercentile };
}

/**
 * 티어점수 = 클리닉 완료율×0.7 + 클리닉 테스트 백분위×0.3.
 * (전체 계산 설명은 getStudentTier 문서 참고.) 한 학생의 반 학생들만
 * 대상으로 계산하므로 전체 학생 배치 계산보다 훨씬 가볍다 — 학생 홈
 * 화면처럼 자주 열리는 곳에서 쓴다.
 */
export async function getStudentTier(studentId: number, lookbackWeeks = 20): Promise<StudentTierInfo | null> {
  const student = await getStudentById(studentId);
  if (!student || !student.class_key) return null;
  const classKey = student.class_key;

  const classmates = await listStudentsByClass(classKey);
  const classmateIds = classmates.map((s) => s.id);

  const weeksDesc = rollingClinicWeeks(lookbackWeeks + 1);
  const weeksAsc = weeksDesc.slice(1).reverse();

  const [templatesByWeek, checksByWeek] = await Promise.all([
    Promise.all(weeksAsc.map((w) => getClinicTemplatesForWeek(w))),
    Promise.all(weeksAsc.map((w) => getClinicChecksForStudents(classmateIds, w))),
  ]);

  const percentileByWeek = weeksAsc.map((_, i) =>
    percentileMapForWeek(templatesByWeek[i].get(classKey), checksByWeek[i], classmateIds)
  );

  const summary = summarizeTier(
    studentId,
    classKey,
    student.created_at,
    weeksAsc,
    templatesByWeek,
    checksByWeek,
    percentileByWeek
  );

  return {
    studentId,
    name: student.name,
    nickname: student.nickname,
    classKey,
    ...summary,
  };
}

/**
 * 전체 학생 티어를 한 번에 계산 — 닉네임 기반 성실도 리더보드용.
 * (student.created_at은 대량 이관 시각이 대부분이라 정확한 등록일은
 * 아니지만, 현재 갖고 있는 유일한 신호라 "등록 후 2주" 유예 판단에 그대로
 * 쓴다 — 기존 학생들은 이관 시점을 기준으로 함께 유예가 풀리고, 신규
 * 등록 학생은 실제 등록일 기준으로 정상 동작한다.)
 */
export async function computeAllStudentTiers(lookbackWeeks = 20): Promise<StudentTierInfo[]> {
  const students = await listStudents({ enrolledOnly: true });
  const weeksDesc = rollingClinicWeeks(lookbackWeeks + 1);
  const weeksAsc = weeksDesc.slice(1).reverse();
  const studentIds = students.map((s) => s.id);

  const [templatesByWeek, checksByWeek] = await Promise.all([
    Promise.all(weeksAsc.map((w) => getClinicTemplatesForWeek(w))),
    Promise.all(weeksAsc.map((w) => getClinicChecksForStudents(studentIds, w))),
  ]);

  const byClass = new Map<ClassKey, number[]>();
  for (const s of students) {
    if (!s.class_key) continue;
    const list = byClass.get(s.class_key) ?? [];
    list.push(s.id);
    byClass.set(s.class_key, list);
  }

  const percentileByWeek: Map<number, number>[] = weeksAsc.map((_, i) => {
    const merged = new Map<number, number>();
    for (const [classKey, ids] of byClass) {
      const map = percentileMapForWeek(templatesByWeek[i].get(classKey), checksByWeek[i], ids);
      for (const [sid, pct] of map) merged.set(sid, pct);
    }
    return merged;
  });

  const results: StudentTierInfo[] = [];
  for (const student of students) {
    if (!student.class_key) continue;
    const summary = summarizeTier(
      student.id,
      student.class_key,
      student.created_at,
      weeksAsc,
      templatesByWeek,
      checksByWeek,
      percentileByWeek
    );
    results.push({
      studentId: student.id,
      name: student.name,
      nickname: student.nickname,
      classKey: student.class_key,
      ...summary,
    });
  }

  return results;
}

/** 닉네임 기반 성실도 리더보드 — 등급 산정 중(eligible=false)인 학생은 제외. */
export async function getTierLeaderboard(): Promise<StudentTierInfo[]> {
  const all = await computeAllStudentTiers();
  return all
    .filter((t) => t.eligible && t.tierScore !== null)
    .sort((a, b) => (b.tierScore ?? 0) - (a.tierScore ?? 0));
}
